<script lang="ts">
	import { DemoLayout, Button, Alert, Panel } from '@wri-datalab/ui';
	import {
		DocumentInput,
		ExampleDocPicker,
		ProcessingStatus,
		ThumbnailGrid,
		SearchBar,
		PageDetail,
		DocHeader,
		ConfigBar,
		QualitySummary,
		ResultsView,
		ComparisonView
	} from '$lib/components';
	import type {
		DocumentState,
		WorkerMessage,
		PageText,
		ChunkStrategyId,
		ChunkOptions,
		ModelProgressPayload,
		ModelReadyPayload,
		ModelErrorPayload,
		BuildProgressPayload,
		SetReadyPayload,
		SearchResultsPayload
	} from '$lib/types';
	import { loadAndParsePDF, type ParseProgress } from '$lib/pdf/parser';
	import { generateThumbnails } from '$lib/pdf/renderer';
	import { embeddingSetKey } from '$lib/embeddings/models';
	import { EXAMPLE_DOCS, type ExampleDoc } from '$lib/data/examples';
	import {
		createInitialDocumentState,
		setDocumentStatus,
		setDocumentError,
		setDocumentPages,
		setPageThumbnail,
		setActiveSetReady,
		resetDocumentState
	} from '$lib/stores/document';
	import {
		createInitialSearchState,
		setSearchQuery,
		setSearchResults,
		setSearching,
		setModelStatus,
		setSelectedPage,
		clearSearchResults,
		resetSearchState,
		type SearchState
	} from '$lib/stores/search';
	import {
		createInitialConfig,
		setConfigModel,
		setConfigBackend,
		type DemoConfig
	} from '$lib/stores/config';
	import {
		createComparison,
		addVariant,
		removeVariant,
		updateVariant,
		setComparisonQuery,
		type ComparisonState
	} from '$lib/stores/comparison';
	import type * as pdfjsLib from 'pdfjs-dist';

	// --- reactive state ---
	let documentState = $state<DocumentState>(createInitialDocumentState());
	let searchState = $state<SearchState>(createInitialSearchState());
	let config = $state<DemoConfig>(createInitialConfig());
	let currentParseProgress = $state<ParseProgress | null>(null);
	let suggestedQueries = $state<string[]>([]);

	// build (re-embed) status for the active set
	let building = $state(false);
	let buildPhase = $state<'chunking' | 'embedding'>('chunking');
	let buildCompleted = $state(0);
	let buildTotal = $state(0);

	// comparison
	let compareMode = $state(false);
	let comparison = $state<ComparisonState | null>(null);

	// --- non-reactive bookkeeping ---
	let worker: Worker | null = null;
	let pdfRef: pdfjsLib.PDFDocumentProxy | null = null;
	let activeKey: string | null = null;
	let docCounter = 0;
	let docId = '';
	let queryCounter = 0;
	let singleSearchId = -1;
	let compareSearchId = -1;
	let pendingCompareQuery: string | null = null;
	let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

	// --- derived ---
	let isIdle = $derived(documentState.status === 'idle');
	let isProcessing = $derived(
		['loading', 'parsing', 'extracting', 'embedding'].includes(documentState.status)
	);
	let isReady = $derived(documentState.status === 'ready');
	let hasError = $derived(documentState.status === 'error');
	let hasSelectedPage = $derived(searchState.selectedPage !== null);

	let selectedPage = $derived(
		searchState.selectedPage
			? documentState.pages.find((p) => p.pageNumber === searchState.selectedPage)
			: null
	);
	let selectedSearchResult = $derived(
		searchState.selectedPage
			? searchState.results.find((r) => r.pageNumber === searchState.selectedPage)
			: undefined
	);

	// --- worker ---
	function initWorker() {
		if (worker) return;
		worker = new Worker(new URL('$lib/embeddings/worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (event: MessageEvent<WorkerMessage>) => handleWorkerMessage(event.data);
	}

	function handleWorkerMessage({ type, payload }: WorkerMessage) {
		switch (type) {
			case 'MODEL_PROGRESS': {
				const p = payload as ModelProgressPayload;
				searchState = setModelStatus(
					searchState,
					'loading',
					p.progress ?? 0,
					p.status === 'progress' ? `Downloading model… ${Math.round(p.progress ?? 0)}%` : p.status
				);
				break;
			}
			case 'MODEL_READY': {
				const p = payload as ModelReadyPayload;
				searchState = setModelStatus(searchState, 'ready', 100, '');
				config = setConfigBackend(config, p.device);
				break;
			}
			case 'MODEL_ERROR': {
				const p = payload as ModelErrorPayload;
				searchState = setModelStatus(searchState, 'error', 0, p.message);
				if (documentState.status !== 'ready') {
					documentState = setDocumentError(documentState, p.message);
				}
				building = false;
				break;
			}
			case 'BUILD_PROGRESS': {
				const p = payload as BuildProgressPayload;
				if (p.key === activeKey) {
					buildPhase = p.phase;
					buildCompleted = p.completed;
					buildTotal = p.total;
					if (documentState.status === 'embedding') {
						const pct = p.phase === 'chunking' ? 0 : (p.completed / Math.max(1, p.total)) * 100;
						documentState = setDocumentStatus(documentState, 'embedding', pct);
					}
				}
				if (comparison) {
					comparison = updateVariant(comparison, findVariantIdByKey(p.key) ?? '', {
						buildPhase: p.phase,
						completed: p.completed,
						total: p.total
					});
				}
				break;
			}
			case 'SET_READY': {
				const p = payload as SetReadyPayload;
				if (p.key === activeKey) {
					building = false;
					documentState = setActiveSetReady(documentState, p.chunkCount);
					if (searchState.query.trim()) doSearch(searchState.query);
				}
				if (comparison) onComparisonSetReady(p);
				break;
			}
			case 'SEARCH_RESULTS': {
				const p = payload as SearchResultsPayload;
				if (p.queryId === compareSearchId && comparison) {
					let c = comparison;
					for (const [key, res] of Object.entries(p.perKey)) {
						for (const v of c.variants) {
							if (v.key === key) {
								c = updateVariant(c, v.id, {
									results: res.results,
									rawChunkResults: res.rawChunkResults,
									metrics: res.metrics
								});
							}
						}
					}
					comparison = { ...c, searching: false };
				} else if (p.queryId === singleSearchId && activeKey && p.perKey[activeKey]) {
					const res = p.perKey[activeKey];
					searchState = setSearchResults(
						searchState,
						res.results,
						res.rawChunkResults,
						res.chunkStrip,
						res.metrics
					);
				}
				break;
			}
		}
	}

	// --- document processing ---
	async function handleFileSelect(file: File) {
		await processDocument(file, file.name);
	}
	async function handleUrlSubmit(url: string) {
		const name = (() => {
			try {
				return new URL(url).pathname.split('/').pop() || 'document.pdf';
			} catch {
				return 'document.pdf';
			}
		})();
		await processDocument(url, name);
	}
	function handleExampleSelect(doc: ExampleDoc) {
		suggestedQueries = doc.suggestedQueries;
		// Fetched and parsed directly from its URL (same path as the URL field).
		processDocument(doc.url, doc.label);
	}

	async function processDocument(source: File | string, filename: string) {
		initWorker();
		documentState = resetDocumentState();
		searchState = resetSearchState();
		comparison = null;
		compareMode = false;
		activeKey = null;
		docCounter += 1;
		docId = `doc-${docCounter}`;
		documentState = setDocumentStatus(documentState, 'loading', 0);

		try {
			const data = source instanceof File ? await source.arrayBuffer() : source;
			const { pdf, pages } = await loadAndParsePDF(data, (progress) => {
				currentParseProgress = progress;
				if (progress.phase === 'loading') {
					documentState = setDocumentStatus(documentState, 'loading', progress.current);
				} else if (progress.phase === 'parsing') {
					documentState = setDocumentStatus(documentState, 'parsing', 0);
				} else if (progress.phase === 'extracting') {
					documentState = setDocumentStatus(
						documentState,
						'extracting',
						(progress.current / progress.total) * 100
					);
				}
			});

			pdfRef = pdf;
			documentState = setDocumentPages(documentState, filename, pages);

			// Start embedding immediately (runs in the worker). Thumbnails render
			// on the main thread in parallel and stream in as they finish —
			// they're not needed to search, so don't block embedding on them.
			documentState = setDocumentStatus(documentState, 'embedding', 0);
			const key = embeddingSetKey(docId, config.modelId, config.strategyId, config.chunkOptions);
			buildSet(key);

			void generateThumbnails(pdf, undefined, (pageNumber, dataUrl) => {
				documentState = setPageThumbnail(documentState, pageNumber, dataUrl);
			}).catch(() => {
				/* thumbnails are non-critical */
			});
		} catch (error) {
			documentState = setDocumentError(
				documentState,
				error instanceof Error ? error.message : 'Failed to process document'
			);
		}
	}

	function pageTexts(): PageText[] {
		return documentState.pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text }));
	}

	function buildSet(key: string) {
		if (!worker) return;
		activeKey = key;
		building = true;
		buildPhase = 'chunking';
		buildCompleted = 0;
		buildTotal = documentState.pageCount;
		// Snapshot to plain data — Svelte $state proxies aren't structured-cloneable.
		worker.postMessage({
			type: 'BUILD_SET',
			payload: $state.snapshot({
				key,
				modelId: config.modelId,
				strategyId: config.strategyId,
				options: config.chunkOptions,
				pages: pageTexts()
			})
		});
	}

	function scheduleRebuild() {
		const key = embeddingSetKey(docId, config.modelId, config.strategyId, config.chunkOptions);
		if (key === activeKey) return; // dedupe — config unchanged
		// Optimistic feedback: show activity immediately, before the debounce fires,
		// so a settings change never looks frozen.
		building = true;
		buildPhase = 'chunking';
		buildCompleted = 0;
		buildTotal = documentState.pageCount;
		if (rebuildTimer) clearTimeout(rebuildTimer);
		rebuildTimer = setTimeout(() => {
			const k = embeddingSetKey(docId, config.modelId, config.strategyId, config.chunkOptions);
			if (k === activeKey) {
				building = false; // dragged back to current config — nothing to do
				return;
			}
			buildSet(k);
		}, 400);
	}

	// --- search ---
	function doSearch(query: string) {
		if (!worker || !activeKey) return;
		if (!query.trim()) {
			searchState = clearSearchResults(searchState);
			return;
		}
		searchState = setSearchQuery(searchState, query);
		searchState = setSearching(searchState, true);
		singleSearchId = ++queryCounter;
		worker.postMessage({
			type: 'SEARCH',
			payload: { queryId: singleSearchId, query: query.trim(), keys: [activeKey], topK: 50 }
		});
	}

	function handleSearch(query: string) {
		doSearch(query);
	}

	// --- config changes (re-embed) ---
	function handleModelChange(modelId: string) {
		config = setConfigModel(config, modelId);
		scheduleRebuild();
	}
	function handleChunkingChange(strategyId: ChunkStrategyId, options: ChunkOptions) {
		config = { ...config, strategyId, chunkOptions: options };
		scheduleRebuild();
	}

	// --- page detail ---
	function handlePageSelect(pageNumber: number) {
		searchState = setSelectedPage(searchState, pageNumber);
	}
	function handleCloseDetail() {
		searchState = setSelectedPage(searchState, null);
	}
	function handlePreviousPage() {
		if (!searchState.selectedPage) return;
		const i = documentState.pages.findIndex((p) => p.pageNumber === searchState.selectedPage);
		if (i > 0) searchState = setSelectedPage(searchState, documentState.pages[i - 1].pageNumber);
	}
	function handleNextPage() {
		if (!searchState.selectedPage) return;
		const i = documentState.pages.findIndex((p) => p.pageNumber === searchState.selectedPage);
		if (i < documentState.pages.length - 1)
			searchState = setSelectedPage(searchState, documentState.pages[i + 1].pageNumber);
	}

	// --- comparison ---
	function findVariantIdByKey(key: string): string | undefined {
		return comparison?.variants.find((v) => v.key === key)?.id;
	}

	function toggleCompare() {
		compareMode = !compareMode;
		if (compareMode && !comparison) comparison = createComparison(config);
		searchState = setSelectedPage(searchState, null);
	}

	function onComparisonQueryChange(q: string) {
		if (comparison) comparison = setComparisonQuery(comparison, q);
	}
	function onVariantModelChange(id: string, modelId: string) {
		if (comparison)
			comparison = updateVariant(comparison, id, {
				modelId,
				status: 'idle',
				results: undefined,
				metrics: undefined
			});
	}
	function onVariantChunkingChange(id: string, strategyId: ChunkStrategyId, options: ChunkOptions) {
		if (comparison)
			comparison = updateVariant(comparison, id, {
				strategyId,
				chunkOptions: options,
				status: 'idle',
				results: undefined,
				metrics: undefined
			});
	}
	function onAddVariant() {
		if (comparison) comparison = addVariant(comparison);
	}
	function onRemoveVariant(id: string) {
		if (comparison) comparison = removeVariant(comparison, id);
	}

	function runComparison() {
		if (!worker || !comparison || !comparison.query.trim()) return;
		const variants = comparison.variants.map((v) => ({
			...v,
			key: embeddingSetKey(docId, v.modelId, v.strategyId, v.chunkOptions),
			status: 'building' as const,
			buildPhase: 'chunking' as const,
			completed: 0,
			total: documentState.pageCount,
			results: undefined,
			rawChunkResults: undefined,
			metrics: undefined
		}));
		comparison = { ...comparison, variants, searching: true };
		pendingCompareQuery = comparison.query.trim();

		const sent = new Set<string>();
		for (const v of variants) {
			if (sent.has(v.key)) continue;
			sent.add(v.key);
			worker.postMessage({
				type: 'BUILD_SET',
				payload: $state.snapshot({
					key: v.key,
					modelId: v.modelId,
					strategyId: v.strategyId,
					options: v.chunkOptions,
					pages: pageTexts()
				})
			});
		}
	}

	function onComparisonSetReady(p: SetReadyPayload) {
		if (!comparison) return;
		let c = comparison;
		for (const v of c.variants) {
			if (v.key === p.key && v.status !== 'ready') {
				c = updateVariant(c, v.id, {
					status: 'ready',
					buildMetrics: p.buildMetrics,
					completed: p.chunkCount,
					total: p.chunkCount
				});
			}
		}
		comparison = c;

		if (
			pendingCompareQuery !== null &&
			worker &&
			comparison.variants.every((v) => v.status === 'ready')
		) {
			const q = pendingCompareQuery;
			pendingCompareQuery = null;
			compareSearchId = ++queryCounter;
			const keys = [...new Set(comparison.variants.map((v) => v.key))];
			worker.postMessage({
				type: 'SEARCH',
				payload: { queryId: compareSearchId, query: q, keys, topK: 50 }
			});
		}
	}

	// --- reset ---
	function handleReset() {
		documentState = resetDocumentState();
		searchState = resetSearchState();
		comparison = null;
		compareMode = false;
		activeKey = null;
		suggestedQueries = [];
		pdfRef = null;
	}

	$effect(() => {
		return () => worker?.terminate();
	});
</script>

<DemoLayout
	title="Semantic Search"
	maxWidth="xl"
	showSettings={false}
	showApiKeys={false}
>
	<!-- Labelled document controls belong in the banner row, not the header
	     (DESIGN.md §4). They also come and go with state, which is exactly the
	     kind of shifting width the header shouldn't absorb. -->
	{#snippet banner()}
		{#if isReady || !isIdle}
			<div class="banner-actions">
				{#if isReady}
					<Button variant="ghost" size="sm" onclick={toggleCompare}>
						{compareMode ? 'Exit compare' : 'Compare configs'}
					</Button>
				{/if}
				{#if !isIdle}
					<Button variant="ghost" size="sm" onclick={handleReset}>New document</Button>
				{/if}
			</div>
		{/if}
	{/snippet}

	<div class="demo-content">
		{#if isIdle}
			<section class="input-section">
				<Panel title="Load a PDF Document">
					<div class="load-panel">
						<ExampleDocPicker examples={EXAMPLE_DOCS} onSelect={handleExampleSelect} />
						<div class="divider"><span>or load your own</span></div>
						<DocumentInput onFileSelect={handleFileSelect} onUrlSubmit={handleUrlSubmit} />
					</div>
				</Panel>

				<div class="info-section">
					<Panel title="How It Works">
						<div class="info-content">
							<div class="info-item">
								<span class="info-number">1</span>
								<div>
									<strong>Load</strong>
									<p>Open a sample, drop a PDF, or paste a URL — text is extracted in your browser.</p>
								</div>
							</div>
							<div class="info-item">
								<span class="info-number">2</span>
								<div>
									<strong>Embed</strong>
									<p>
										Each passage becomes a vector (an embedding) that captures meaning; your query
										becomes a vector too.
									</p>
								</div>
							</div>
							<div class="info-item">
								<span class="info-number">3</span>
								<div>
									<strong>Search</strong>
									<p>
										Closest vectors win — relevant passages surface even when they use different words
										than your query.
									</p>
								</div>
							</div>
						</div>
					</Panel>

					<Panel title="Privacy">
						<p class="privacy-note">
							All processing happens in your browser. Your documents never leave your device. The
							embedding model is downloaded once and cached locally.
						</p>
					</Panel>
				</div>
			</section>
		{/if}

		{#if hasError}
			<section class="error-section">
				<Alert variant="error">
					{#snippet title()}
						Error
					{/snippet}
					{documentState.error}
				</Alert>
				<Button variant="secondary" onclick={handleReset}>Try Again</Button>
			</section>
		{/if}

		{#if isProcessing}
			<section class="processing-section">
				<ProcessingStatus
					documentStatus={documentState.status}
					documentProgress={documentState.progress}
					modelStatus={searchState.modelStatus}
					modelProgress={searchState.modelProgress}
					modelMessage={searchState.modelProgressMessage}
					totalPages={documentState.pageCount}
					currentPage={currentParseProgress?.current ?? 0}
					totalChunks={buildTotal}
					embeddedChunks={buildCompleted}
				/>
				{#if documentState.pages.length > 0}
					<ThumbnailGrid pages={documentState.pages} searchResults={[]} selectedPage={null} />
				{/if}
			</section>
		{/if}

		{#if isReady && compareMode && comparison}
			<section class="compare-section">
				<DocHeader
					filename={documentState.filename ?? ''}
					pageCount={documentState.pageCount}
					chunkCount={documentState.chunkCount}
					modelId={config.modelId}
					backend={config.backend}
				/>
				<ComparisonView
					{comparison}
					pages={documentState.pages}
					onQueryChange={onComparisonQueryChange}
					onRun={runComparison}
					{onVariantModelChange}
					{onVariantChunkingChange}
					{onAddVariant}
					{onRemoveVariant}
				/>
			</section>
		{/if}

		{#if isReady && !compareMode && !hasSelectedPage}
			<section class="search-section">
				<DocHeader
					filename={documentState.filename ?? ''}
					pageCount={documentState.pageCount}
					chunkCount={documentState.chunkCount}
					modelId={config.modelId}
					backend={config.backend}
				/>

				<ConfigBar
					modelId={config.modelId}
					strategyId={config.strategyId}
					chunkOptions={config.chunkOptions}
					{building}
					{buildPhase}
					{buildCompleted}
					{buildTotal}
					modelStatus={searchState.modelStatus}
					modelProgress={searchState.modelProgress}
					onModelChange={handleModelChange}
					onChunkingChange={handleChunkingChange}
				/>

				<SearchBar
					bind:value={searchState.query}
					disabled={false}
					isSearching={searchState.isSearching}
					modelStatus={searchState.modelStatus}
					{suggestedQueries}
					onSearch={handleSearch}
				/>

				<Panel title="Search quality" collapsible>
					<QualitySummary
						metrics={searchState.metrics}
						modelId={config.modelId}
						backend={config.backend}
					/>
				</Panel>

				<ResultsView
					pages={documentState.pages}
					results={searchState.results}
					rawChunkResults={searchState.rawChunkResults}
					chunkStrip={searchState.chunkStrip}
					query={searchState.query}
					threshold={searchState.metrics?.threshold ?? 0.5}
					selectedPage={searchState.selectedPage}
					dimmed={building}
					onPageSelect={handlePageSelect}
				/>
			</section>
		{/if}

		{#if isReady && !compareMode && hasSelectedPage && selectedPage}
			<section class="detail-section">
				<PageDetail
					page={selectedPage}
					searchResult={selectedSearchResult}
					query={searchState.query}
					fullPageImage={selectedPage.thumbnail}
					onClose={handleCloseDetail}
					onPrevious={handlePreviousPage}
					onNext={handleNextPage}
					hasPrevious={selectedPage.pageNumber > 1}
					hasNext={selectedPage.pageNumber < documentState.pageCount}
				/>
			</section>
		{/if}
	</div>
</DemoLayout>

<style>
	.banner-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.demo-content {
		max-width: var(--max-width, 1200px);
		margin: 0 auto;
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.input-section {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-6);
	}

	@media (max-width: 768px) {
		.input-section {
			grid-template-columns: 1fr;
		}
	}

	.load-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.divider {
		display: flex;
		align-items: center;
		text-align: center;
		color: var(--tx-3);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background-color: var(--ui);
	}

	.divider span {
		padding: 0 var(--space-3);
	}

	.info-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.info-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.info-item {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}

	.info-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background-color: var(--primary);
		color: var(--primary-content);
		border-radius: 50%;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		flex-shrink: 0;
	}

	.info-item strong {
		display: block;
		margin-bottom: var(--space-1);
	}

	.info-item p {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--tx-2);
	}

	.privacy-note {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--tx-2);
		line-height: 1.6;
	}

	.error-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		align-items: flex-start;
	}

	.processing-section,
	.search-section,
	.compare-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.detail-section {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
</style>
