<script lang="ts">
	import { DemoLayout, Button, Alert, Panel } from '@wri-datalab/ui';
	import {
		DocumentInput,
		ProcessingStatus,
		ThumbnailGrid,
		SearchBar,
		PageDetail
	} from '$lib/components';
	import type {
		DocumentState,
		Page,
		Chunk,
		SearchResult,
		ModelStatus,
		WorkerMessage,
		ModelProgressPayload,
		EmbedProgressPayload,
		ChunksEmbeddedPayload,
		QueryEmbeddedPayload
	} from '$lib/types';
	import { loadAndParsePDF, type ParseProgress } from '$lib/pdf/parser';
	import { generateThumbnails } from '$lib/pdf/renderer';
	import { search } from '$lib/embeddings/search';
	import {
		createInitialDocumentState,
		setDocumentStatus,
		setDocumentError,
		setDocumentPages,
		setPageThumbnail,
		setChunksWithEmbeddings,
		getAllChunksFromState,
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
	import type * as pdfjsLib from 'pdfjs-dist';

	// State
	let documentState = $state<DocumentState>(createInitialDocumentState());
	let searchState = $state<SearchState>(createInitialSearchState());
	let pdfRef = $state<pdfjsLib.PDFDocumentProxy | null>(null);
	let worker: Worker | null = null;
	let currentParseProgress = $state<ParseProgress | null>(null);

	// Derived state
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

	// Initialize worker
	function initWorker() {
		if (worker) return;

		worker = new Worker(
			new URL('$lib/embeddings/worker.ts', import.meta.url),
			{ type: 'module' }
		);

		worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
			const { type, payload } = event.data;

			switch (type) {
				case 'MODEL_PROGRESS': {
					const progress = payload as ModelProgressPayload;
					searchState = setModelStatus(
						searchState,
						'loading',
						progress.progress ?? 0,
						progress.status === 'progress'
							? `Downloading model... ${Math.round(progress.progress ?? 0)}%`
							: progress.status
					);
					break;
				}

				case 'MODEL_READY': {
					searchState = setModelStatus(searchState, 'ready', 100, '');
					break;
				}

				case 'MODEL_ERROR': {
					const error = payload as { message: string };
					searchState = setModelStatus(searchState, 'error', 0, error.message);
					documentState = setDocumentError(documentState, error.message);
					break;
				}

				case 'EMBED_PROGRESS': {
					const progress = payload as EmbedProgressPayload;
					documentState = setDocumentStatus(
						documentState,
						'embedding',
						(progress.completed / progress.total) * 100
					);
					break;
				}

				case 'CHUNKS_EMBEDDED': {
					const result = payload as ChunksEmbeddedPayload;
					documentState = setChunksWithEmbeddings(documentState, result.chunks);
					break;
				}

				case 'QUERY_EMBEDDED': {
					const result = payload as QueryEmbeddedPayload;
					performSearch(result.embedding);
					break;
				}
			}
		};
	}

	// Handle file selection
	async function handleFileSelect(file: File) {
		await processDocument(file);
	}

	// Handle URL submission
	async function handleUrlSubmit(url: string) {
		await processDocument(url);
	}

	// Process document (file or URL)
	async function processDocument(source: File | string) {
		initWorker();

		// Reset state
		documentState = resetDocumentState();
		searchState = resetSearchState();
		documentState = setDocumentStatus(documentState, 'loading', 0);

		try {
			// Get filename
			const filename = source instanceof File
				? source.name
				: new URL(source).pathname.split('/').pop() || 'document.pdf';

			// Load and parse PDF
			const data = source instanceof File
				? await source.arrayBuffer()
				: source;

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

			// Generate thumbnails
			const thumbnails = await generateThumbnails(pdf, (current, total) => {
				const progress = (current / total) * 100;
				documentState = setDocumentStatus(documentState, 'extracting', progress);
			});

			// Update pages with thumbnails
			for (const [pageNumber, thumbnail] of thumbnails) {
				documentState = setPageThumbnail(documentState, pageNumber, thumbnail);
			}

			// Start embedding
			documentState = setDocumentStatus(documentState, 'embedding', 0);
			const allChunks = $state.snapshot(getAllChunksFromState(documentState));

			if (allChunks.length > 0) {
				worker?.postMessage({
					type: 'EMBED_CHUNKS',
					payload: { chunks: allChunks }
				});
			} else {
				// No chunks to embed, mark as ready
				documentState = setDocumentStatus(documentState, 'ready', 100);
			}
		} catch (error) {
			documentState = setDocumentError(
				documentState,
				error instanceof Error ? error.message : 'Failed to process document'
			);
		}
	}

	// Handle search
	function handleSearch(query: string) {
		if (!query.trim()) {
			searchState = clearSearchResults(searchState);
			return;
		}

		searchState = setSearchQuery(searchState, query);
		searchState = setSearching(searchState, true);

		// Request query embedding
		worker?.postMessage({
			type: 'EMBED_QUERY',
			payload: { query }
		});
	}

	// Perform search with query embedding
	function performSearch(queryEmbedding: number[]) {
		const allChunks = $state.snapshot(getAllChunksFromState(documentState));
		const results = search(allChunks, queryEmbedding);
		searchState = setSearchResults(searchState, results);
	}

	// Handle page selection
	function handlePageSelect(pageNumber: number) {
		searchState = setSelectedPage(searchState, pageNumber);
	}

	// Handle page detail close
	function handleCloseDetail() {
		searchState = setSelectedPage(searchState, null);
	}

	// Navigate pages
	function handlePreviousPage() {
		if (!searchState.selectedPage) return;
		const currentIndex = documentState.pages.findIndex(
			(p) => p.pageNumber === searchState.selectedPage
		);
		if (currentIndex > 0) {
			searchState = setSelectedPage(
				searchState,
				documentState.pages[currentIndex - 1].pageNumber
			);
		}
	}

	function handleNextPage() {
		if (!searchState.selectedPage) return;
		const currentIndex = documentState.pages.findIndex(
			(p) => p.pageNumber === searchState.selectedPage
		);
		if (currentIndex < documentState.pages.length - 1) {
			searchState = setSelectedPage(
				searchState,
				documentState.pages[currentIndex + 1].pageNumber
			);
		}
	}

	// Reset and start over
	function handleReset() {
		documentState = resetDocumentState();
		searchState = resetSearchState();
		pdfRef = null;
	}

	// Cleanup
	$effect(() => {
		return () => {
			worker?.terminate();
		};
	});
</script>

<DemoLayout
	title="Semantic Search"
	subtitle="Search PDFs by meaning, not just keywords"
	maxWidth="xl"
	showSettings={false}
	showApiKeys={false}
>
	{#snippet headerActions()}
		{#if !isIdle}
			<Button variant="ghost" size="sm" onclick={handleReset}>
				New Document
			</Button>
		{/if}
	{/snippet}

	<div class="demo-content">
		{#if isIdle}
			<section class="input-section">
				<Panel title="Load a PDF Document">
					<DocumentInput
						onFileSelect={handleFileSelect}
						onUrlSubmit={handleUrlSubmit}
					/>
				</Panel>

				<div class="info-section">
					<Panel title="How It Works">
						<div class="info-content">
							<div class="info-item">
								<span class="info-number">1</span>
								<div>
									<strong>Upload</strong>
									<p>Drop a PDF file or enter a URL</p>
								</div>
							</div>
							<div class="info-item">
								<span class="info-number">2</span>
								<div>
									<strong>Process</strong>
									<p>Text is extracted and embedded using AI</p>
								</div>
							</div>
							<div class="info-item">
								<span class="info-number">3</span>
								<div>
									<strong>Search</strong>
									<p>Find relevant pages by meaning, not keywords</p>
								</div>
							</div>
						</div>
					</Panel>

					<Panel title="Privacy">
						<p class="privacy-note">
							All processing happens in your browser. Your documents never leave your device.
							The embedding model is downloaded once and cached locally.
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
				<Button variant="secondary" onclick={handleReset}>
					Try Again
				</Button>
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
					totalChunks={getAllChunksFromState(documentState).length}
					embeddedChunks={Math.round(documentState.progress / 100 * getAllChunksFromState(documentState).length)}
				/>

				{#if documentState.pages.length > 0}
					<ThumbnailGrid
						pages={documentState.pages}
						searchResults={[]}
						selectedPage={null}
					/>
				{/if}
			</section>
		{/if}

		{#if isReady && !hasSelectedPage}
			<section class="search-section">
				<div class="search-header">
					<div class="document-info">
						<h2>{documentState.filename}</h2>
						<span class="page-count">{documentState.pageCount} pages</span>
					</div>
				</div>

				<SearchBar
					bind:value={searchState.query}
					disabled={false}
					isSearching={searchState.isSearching}
					modelStatus={searchState.modelStatus}
					onSearch={handleSearch}
				/>

				<ThumbnailGrid
					pages={documentState.pages}
					searchResults={searchState.results}
					selectedPage={searchState.selectedPage}
					onPageSelect={handlePageSelect}
				/>
			</section>
		{/if}

		{#if isReady && hasSelectedPage && selectedPage}
			<section class="detail-section">
				<PageDetail
					page={selectedPage}
					searchResult={selectedSearchResult}
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

	.processing-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.search-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.search-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.document-info {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
	}

	.document-info h2 {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.page-count {
		font-size: var(--font-size-sm);
		color: var(--tx-3);
	}

	.detail-section {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
</style>
