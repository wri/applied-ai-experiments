# WRI Applied AI Experiments

**A public field guide to applying AI at WRI, built in public.**

WRI's Applied AI Group runs small, time-boxed experiments that test model
capabilities, gauge feature feasibility, and kick the tires on new
infrastructure — so the rest of WRI's AI work doesn't have to guess. Each one
ends with a signal check against its own success criteria and learnings others can act
on, and we publish the working demos, the findings, and the dead ends while the
work is still in progress.

These are lab prototypes and demos. **They are not products.**

Browse it all at **https://wri.github.io/applied-ai-experiments/** — the
[`hub/`](./hub/) Astro site turns every experiment's metadata into a gallery, a
**Learnings** feed of per-experiment learnings, and curated cross-experiment
**Insights**.

## How it fits together

```
applied-ai-experiments/
├── experiments/         One folder per experiment — brief.md (frontmatter + narrative), README.md, optional demo/
├── packages/            Shared libraries (UI components, LLM machinery, BYOK) — see packages/README.md
├── hub/                 Astro site that aggregates experiments into the public gallery
├── insights/            Curated cross-experiment synthesis, surfaced on the hub
├── docs/                Process documentation — start with docs/vision.md
└── .github/             Scripts, experiment templates, and CI
```

Every experiment is a directory with two documents: `brief.md` — a small metadata
contract in YAML frontmatter followed by the narrative — and `README.md` for how
to run the code. Optionally a statically built demo deployed to GitHub Pages.

## Quick start

```bash
# Prerequisites: just, pnpm, uv, and Node — the versions are pinned in
# .nvmrc and package.json's packageManager field.
uv sync
uvx pre-commit install   # optional, but it catches what CI checks

just new-experiment                          # interactive template picker
just new-experiment my-experiment prototype  # or positional: name, template
```

The scaffold prompts for title, description, and `targets`, and fills the brief's
frontmatter — so a fresh experiment passes `just validate-strict` with no hand edits.

### Common commands

```bash
just doctor              # health check — run this before opening a PR
just validate            # validate experiment metadata (--strict to fail on warnings)
just list-experiments    # every experiment with its status and type
just list-templates      # available templates, with descriptions
just generate-index      # regenerate experiment-index.json
just dev-hub             # run the hub locally
just build-demos         # build all demos
```

`just doctor` bundles everything CI checks plus what CI can't: the gate sweep, the
doc-drift check, and whether the committed pipeline is self-contained. Run `just`
on its own for the full recipe list.

## Templates and types

These are **two different axes.** The template is the scaffold you start from
(`just list-templates` describes each one); the type is what the finished artifact
is — `prototype`, `evaluation`, `benchmark`, `spike`, `research`, `notebook`, or
`marimo`. Prototypes always ship a demo; notebooks and evaluations often do;
spikes and research rarely do.

## How experiments are classified

Two orthogonal axes, both in the brief's frontmatter:

**`targets`** — what conceptual layer the work aims at:

| Value | Core question |
|---|---|
| `capability` | What can the tools do? |
| `infra` | Can we build and run this? |
| `feature` | Should we build this, and how? |

**`themes`** — which of nine learning-agenda themes it advances (the first is
primary):

| Theme | Description |
|-------|-------------|
| `cost-perf` | Cost, performance, and carbon optimization |
| `evals` | Evaluation and benchmarking |
| `patterns` | Product integration patterns |
| `geospatial` | Geospatial intelligence |
| `reliability` | Factuality and grounding systems |
| `agents` | Agentic workflows |
| `scouting` | Technology landscape scanning |
| `prototyping` | Feature exploration and prototyping |
| `development` | AI-assisted software development |

The enums are defined once in `.github/scripts/experiment_schema.py`;
`just check-schema-sync` keeps the TypeScript types and the hub taxonomy honest
against it.

## Contributing

Work happens on an `exp/<slug>` branch and lands via a PR. Every experiment
closes out with a signal check against the signals it declared up front — see the PR
checklist in
[`.github/pull_request_template.md`](./.github/pull_request_template.md), or open
a **New experiment** issue to have the scaffold and PR created for you.

Demos deploy to GitHub Pages when a commit on `main` includes **`[deploy]`** in
its message, or via manual workflow dispatch.

## Deeper documentation

The process docs (`docs/`), the contributor guides (`ONBOARDING.md`,
`CONTRIBUTING.md`), the repo conventions (`AGENTS.md`), and the design-system
contract (`DESIGN.md`) are **not tracked in git yet** — they exist in the working
repo and will land here when they do. Everything you need to *run* this repo is
above; [`packages/README.md`](./packages/README.md) is the index of what the shared
libraries give you.

## License

[MIT](LICENSE)
