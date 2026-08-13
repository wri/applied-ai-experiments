export interface ViewportContext {
	center: [number, number];
	zoom: number;
	bearing: number;
	pitch: number;
	bounds: [[number, number], [number, number]] | null;
	/** approximate meters per pixel at center */
	metersPerPixel: number;
	/** approximate width of the viewport in km */
	viewWidthKm: number;
}

export interface LayerContext {
	id: string;
	type: string;
	source: string;
	visible: boolean;
	featureCountInView: number;
	/** small sample of attribute keys + example values */
	attributes: Record<string, unknown> | null;
}

export interface FeatureSummary {
	layerId: string;
	properties: Record<string, unknown>;
}

export interface EnvironmentContext {
	userAgent: string;
	language: string;
	languages: string[];
	timezone: string;
	viewportPx: { width: number; height: number };
	devicePixelRatio: number;
	prefersColorScheme: 'dark' | 'light';
	prefersReducedMotion: boolean;
	online: boolean;
	touch: boolean;
}

export interface SessionContext {
	activeDemo: string;
	theme: string;
	basemap: string;
	llmMode: 'mock' | 'live';
	lastVisit: string | null;
	localTime: string;
	timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface DerivedContext {
	placeName: string | null;
	approxScale: string;
}

export interface ContextSnapshot {
	capturedAt: string;
	viewport: ViewportContext;
	layers: LayerContext[];
	featuresAtPoint: FeatureSummary[] | null;
	environment: EnvironmentContext;
	session: SessionContext;
	derived: DerivedContext;
}
