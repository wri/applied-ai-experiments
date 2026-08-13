/**
 * Build-time Open Graph card generation.
 *
 * Renders a 1200×630 social-preview PNG in the Prototype "lab interface" aesthetic
 * (warm-neutral background, amber accent, IBM Plex Mono) via satori (layout → SVG)
 * and @resvg/resvg-js (SVG → PNG). Used by the og/[slug].png + og/default.png
 * endpoints, so every experiment + the hub get a real social card.
 *
 * Fonts are bundled (src/assets/fonts) because satori needs raw font data; the
 * Prototype heading/UI font is IBM Plex Mono, so the whole card is monospace.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

// --- Palette (Prototype dark tokens, resolved to sRGB for satori) -----------
const COLOR = {
  bg: "#1c1a18", // --bg
  panel: "#282523", // --bg-2
  text: "#ece8e4", // --tx
  text2: "#a8a29e", // --tx-2
  text3: "#706a64", // --tx-3
  border: "#433d38", // --ui
  amber: "#f0b032", // ≈ --primary oklch(0.800 0.170 85)
} as const;

// --- Fonts (loaded once) ----------------------------------------------------
// Resolved from cwd: `astro build`/`astro dev` always run from the hub dir
// (CI does `cd hub && pnpm build`). import.meta.url is unreliable here because
// Vite bundles this module into .astro/chunks/ and rewrites the URL.
const font = (file: string) => readFileSync(join(process.cwd(), "src", "assets", "fonts", file));

const FONTS = [
  { name: "IBM Plex Mono", data: font("IBMPlexMono-Regular.ttf"), weight: 400 as const, style: "normal" as const },
  { name: "IBM Plex Mono", data: font("IBMPlexMono-Medium.ttf"), weight: 500 as const, style: "normal" as const },
];

const WIDTH = 1200;
const HEIGHT = 630;

// Tiny hyperscript helper so we can build satori nodes without JSX.
type Node = { type: string; props: { style: Record<string, unknown>; children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: children === undefined ? { style } : { style, children },
});

/** Hard-truncate at a word boundary so satori never overflows the canvas. */
function clamp(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Title scales down as it gets longer so 1–4 lines always fit. */
function titleSize(title: string): number {
  if (title.length > 48) return 54;
  if (title.length > 30) return 64;
  return 74;
}

export interface OgCardOptions {
  title: string;
  description?: string;
  /** Small pills, top-right (e.g. type). */
  badges?: { label: string; color?: string }[];
  /** Footer URL/eyebrow, defaults to the site root path. */
  footer?: string;
}

function pill(label: string, color: string): Node {
  return h(
    "div",
    {
      display: "flex",
      alignItems: "center",
      border: `2px solid ${color}`,
      borderRadius: "8px",
      color,
      fontSize: "24px",
      fontWeight: 500,
      letterSpacing: "1px",
      padding: "6px 16px",
      textTransform: "uppercase",
    },
    label,
  );
}

function card(opts: OgCardOptions): Node {
  const title = clamp(opts.title, 96);
  const description = opts.description ? clamp(opts.description, 168) : "";
  const badges = opts.badges ?? [];

  // Wordmark: amber square mark + product name.
  const wordmark = h(
    "div",
    { display: "flex", alignItems: "center", gap: "16px" },
    [
      h("div", {
        display: "flex",
        width: "30px",
        height: "30px",
        backgroundColor: COLOR.amber,
        borderRadius: "6px",
      }),
      h(
        "div",
        {
          display: "flex",
          color: COLOR.text2,
          fontSize: "24px",
          fontWeight: 500,
          letterSpacing: "3px",
        },
        "WRI Applied AI Group | Experiments",
      ),
    ],
  );

  const header = h(
    "div",
    { display: "flex", alignItems: "center", justifyContent: "space-between" },
    [
      wordmark,
      h(
        "div",
        { display: "flex", gap: "12px" },
        badges.map((b) => pill(b.label, b.color ?? COLOR.amber)),
      ),
    ],
  );

  const middleChildren: Node[] = [
    h(
      "div",
      {
        display: "flex",
        color: COLOR.text,
        fontSize: `${titleSize(title)}px`,
        fontWeight: 500,
        lineHeight: 1.12,
        letterSpacing: "-1px",
      },
      title,
    ),
  ];
  if (description) {
    middleChildren.push(
      h(
        "div",
        {
          display: "flex",
          color: COLOR.text2,
          fontSize: "30px",
          fontWeight: 400,
          lineHeight: 1.4,
          maxWidth: "980px",
        },
        description,
      ),
    );
  }
  const middle = h(
    "div",
    { display: "flex", flexDirection: "column", gap: "28px" },
    middleChildren,
  );

  const footer = h(
    "div",
    {
      display: "flex",
      alignItems: "center",
      borderTop: `2px solid ${COLOR.border}`,
      paddingTop: "24px",
      color: COLOR.text3,
      fontSize: "24px",
      fontWeight: 400,
    },
    opts.footer ?? "wri.github.io/applied-ai-experiments",
  );

  const content = h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      flex: 1,
      padding: "64px 72px",
    },
    [header, middle, footer],
  );

  // Amber accent rail on the left edge.
  const rail = h("div", { display: "flex", width: "16px", height: `${HEIGHT}px`, backgroundColor: COLOR.amber });

  return h(
    "div",
    {
      display: "flex",
      flexDirection: "row",
      width: `${WIDTH}px`,
      height: `${HEIGHT}px`,
      backgroundColor: COLOR.bg,
      fontFamily: "IBM Plex Mono",
    },
    [rail, content],
  );
}

/** Render an OG card to PNG bytes (Uint8Array is a valid Response BodyInit). */
export async function renderOgCard(opts: OgCardOptions): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(card(opts) as never, { width: WIDTH, height: HEIGHT, fonts: FONTS });
  return new Uint8Array(new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng());
}

/** Card for a single experiment (type badge). */
export function experimentOg(exp: {
  title: string;
  description?: string;
  type?: string;
  slug: string;
}): Promise<Uint8Array<ArrayBuffer>> {
  const badges: { label: string; color?: string }[] = [];
  if (exp.type) badges.push({ label: exp.type, color: COLOR.amber });
  return renderOgCard({
    title: exp.title,
    description: exp.description,
    badges,
    footer: `wri.github.io/applied-ai-experiments/${exp.slug}`,
  });
}

/** Card for a curated insight (Article-style badge). */
export function insightOg(insight: {
  title: string;
  summary?: string;
  slug: string;
}): Promise<Uint8Array<ArrayBuffer>> {
  return renderOgCard({
    title: insight.title,
    description: insight.summary,
    badges: [{ label: "insight", color: COLOR.amber }],
    footer: `wri.github.io/applied-ai-experiments/insights/${insight.slug}`,
  });
}

/** Default/fallback card for the hub home + section pages. */
export function defaultOg(): Promise<Uint8Array<ArrayBuffer>> {
  return renderOgCard({
    title: "AI Experiments Hub",
    description:
      "A living record of what the WRI Applied AI Group has tried — and what we learned. Prototypes, evaluations, and field notes.",
    badges: [{ label: "Portfolio", color: COLOR.amber }],
  });
}
