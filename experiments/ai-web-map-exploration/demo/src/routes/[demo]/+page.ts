import { demos } from '$lib/demos/registry';
import type { EntryGenerator } from './$types';

// The crawler can't discover these: `ssr = false` means no markup is generated at
// build time, so the sidebar's links don't exist for it to follow. List them from
// the same registry the nav uses, so a new demos/<slug>/meta.ts gets a prerendered
// URL without anyone remembering to add it here.
export const entries: EntryGenerator = () => demos.map((d) => ({ demo: d.slug }));
