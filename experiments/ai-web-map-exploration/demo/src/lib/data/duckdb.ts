/**
 * Lazy DuckDB-WASM bootstrap. Nothing here loads until the demo calls
 * getDuckDB() — the wasm bundle (~35 MB, from jsDelivr) stays out of every
 * other route's chunks, and is fetched once per session.
 */

import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';

let dbPromise: Promise<AsyncDuckDB> | null = null;

export function getDuckDB(): Promise<AsyncDuckDB> {
	dbPromise ??= init();
	return dbPromise;
}

/**
 * Drop the memoized instance so the next getDuckDB() boots a fresh worker.
 * A wasm heap that has overflowed ("memory access out of bounds") stays
 * poisoned — every later query fails until the worker is replaced.
 */
export function resetDuckDB(): void {
	dbPromise?.then((db) => db.terminate()).catch(() => {});
	dbPromise = null;
}

async function init(): Promise<AsyncDuckDB> {
	const duckdb = await import('@duckdb/duckdb-wasm');
	const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
	// Same-origin worker shim around the CDN-hosted worker script.
	const workerUrl = URL.createObjectURL(
		new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
	);
	try {
		const worker = new Worker(workerUrl);
		const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
		await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
		return db;
	} finally {
		URL.revokeObjectURL(workerUrl);
	}
}
