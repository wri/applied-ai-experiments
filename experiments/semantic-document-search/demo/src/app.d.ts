// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// Vite asset imports
declare module '*?url' {
	const url: string;
	export default url;
}

declare module '*?worker' {
	const workerConstructor: new () => Worker;
	export default workerConstructor;
}

export {};
