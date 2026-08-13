set quiet := true
# justfile
# Run: `just new-experiment`
# Or:  `just new-experiment my-run experiment-minimal`  (positional: name, template)

set shell := ["bash", "-euo", "pipefail", "-c"]


EXPERIMENTS_DIR := "experiments"
TEMPLATES_DIR   := ".github/templates"

# ============================================
# Help
# ============================================

# Show all available recipes (this runs when you type `just` with no arguments)
default:
    just --list

# Alias for `default`
help:
    just --list

# ============================================
# Setup Commands
# ============================================

# List the available templates with descriptions.
list-templates:
    #!/usr/bin/env bash
    # scaffold_template.py owns both the "what counts as a template" rule
    # (skips _shared/) and the descriptions, so there's one copy of each.
    printf "Available templates:\n"
    python3 .github/scripts/scaffold_template.py --list --describe | sed 's/^/  /'

# Scaffold a new experiment from a template (interactive; or positional: just new-experiment <name> <template>)
new-experiment name='' template='':
    #!/usr/bin/env bash
    # Ensure base dirs exist
    [[ -d "{{TEMPLATES_DIR}}" ]] || { echo "Missing '{{TEMPLATES_DIR}}' directory." >&2; exit 1; }
    mkdir -p "{{EXPERIMENTS_DIR}}"

    # Template descriptions live in scaffold_template.py (single source).
    get_template_desc() {
      python3 -c "import sys; sys.path.insert(0, '.github/scripts'); import scaffold_template as s; print(s.describe(sys.argv[1]))" "$1"
    }

    # Function to list templates (one per line); skips composition dirs like _shared/
    templates_list() {
      python3 .github/scripts/scaffold_template.py --list 2>/dev/null
    }

    # Build an array of templates without using `mapfile`
    TEMPLATES=()
    while IFS= read -r t; do
      [[ -n "$t" ]] && TEMPLATES+=("$t")
    done < <(templates_list)

    if (( ${#TEMPLATES[@]} == 0 )); then
      echo "No templates found under '{{TEMPLATES_DIR}}'." >&2
      exit 1
    fi

    # Choose template (fzf if available, otherwise menu)
    SELECTED_TEMPLATE="{{template}}"
    if [[ -z "$SELECTED_TEMPLATE" ]]; then
      if command -v fzf >/dev/null 2>&1; then
        SELECTED_TEMPLATE="$(templates_list | fzf --prompt='Template > ' --height=15 --reverse || true)"
      fi
      if [[ -z "$SELECTED_TEMPLATE" ]]; then
        echo ""
        echo "Available templates:"
        for i in "${!TEMPLATES[@]}"; do
          t="${TEMPLATES[$i]}"
          desc="$(get_template_desc "$t")"
          if [[ -n "$desc" ]]; then
            printf "  [%d] %-20s %s\n" "$((i+1))" "$t" "$desc"
          else
            printf "  [%d] %s\n" "$((i+1))" "$t"
          fi
        done
        echo ""
        read -rp "Choose a template by number or name [1]: " CHOICE
        CHOICE="${CHOICE:-1}"
        if [[ "$CHOICE" =~ ^[0-9]+$ ]]; then
          idx=$((CHOICE-1))
          SELECTED_TEMPLATE="${TEMPLATES[$idx]:-}"
        else
          SELECTED_TEMPLATE="$CHOICE"
        fi
      fi
    fi

    # Template validity is checked by scaffold_template.py at copy time, which
    # also rejects composition dirs like _shared/ and prints the valid list.

    # Ask for experiment name (dest = experiments/<name>)
    NAME="{{name}}"
    if [[ -z "$NAME" ]]; then
      DEFAULT_NAME="$(date +%Y-%m-%d)-experiment"
      read -rp "New experiment folder name (under '{{EXPERIMENTS_DIR}}') [${DEFAULT_NAME}]: " NAME
      NAME="${NAME:-$DEFAULT_NAME}"
    fi

    # Basic name validation
    if [[ ! "$NAME" =~ ^[a-zA-Z0-9._-]+$ ]]; then
      echo "Invalid name '$NAME'. Use only letters, numbers, '.', '_', '-'." >&2
      exit 1
    fi

    DEST="{{EXPERIMENTS_DIR}}/$NAME"
    if [[ -e "$DEST" ]]; then
      echo "Destination '$DEST' already exists. Choose a different name." >&2
      exit 1
    fi

    # Compose the scaffold: _shared/ first, then the type template overlaid on top
    # (so a type template can override a shared file — prototype-byok does).
    # copytree handles dotfiles natively, so no dotglob dance is needed.
    python3 .github/scripts/scaffold_template.py \
      --template "$SELECTED_TEMPLATE" --dest "$DEST" || exit 1

    # Fill metadata via the canonical script (dates, title/description, targets,
    # demo package name; also syncs the app.html SEO block for prototypes) so a
    # fresh scaffold passes `just validate-strict` with no hand edits.
    #
    # Two defaults are load-bearing. Never fall back to "CHANGEME" — that string
    # is on the validator's placeholder blacklist, so it guarantees the failure
    # this step exists to prevent. And always set `targets`: templates ship it
    # empty, an empty `targets` is a warning, and `--strict` makes warnings errors.
    TITLE="" DESC="" TARGETS=""
    if [[ -t 0 ]]; then
      read -rp "Title [${NAME}]: " TITLE
      read -rp "One-line description [${TITLE:-$NAME}]: " DESC
      echo "  capability = what can the tools do?  infra = can we build and run this?  feature = should we build this?"
      read -rp "Targets (capability/infra/feature) [capability]: " TARGETS
    fi
    TITLE="${TITLE:-$NAME}"
    DESC="${DESC:-$TITLE}"
    TARGETS="${TARGETS:-capability}"
    uv run .github/scripts/fill-metadata.py "$DEST" \
      --title "$TITLE" --description "$DESC" --targets "$TARGETS"

    echo "✅ Created '$DEST' from template '$SELECTED_TEMPLATE'"
    echo ""
    # Show template description if available
    desc="$(get_template_desc "$SELECTED_TEMPLATE")"
    if [[ -n "$desc" ]]; then
      echo "Template: $desc"
      echo ""
    fi
    echo "Contents:"
    if command -v tree >/dev/null 2>&1; then
      (cd "$DEST" && tree -a -L 2)
    else
      (cd "$DEST" && find . -maxdepth 2 -print)
    fi
    echo ""
    echo "Next steps:"
    echo "  - Write brief.md — the Before section (what question, what signals, what boundaries)"
    if [[ -d "$DEST/demo" ]]; then
      echo "  - cd \"$DEST/demo\" && pnpm install && pnpm dev"
    fi
    echo "  - just validate"

# ============================================
# Experiment Management Commands
# ============================================

# Generate the experiment index from every experiment brief
generate-index:
    uv run .github/scripts/generate-index.py

# Validate all experiment metadata
validate *ARGS:
    uv run .github/scripts/validate-experiments.py {{ARGS}}

# Validate strictly (warnings become errors)
validate-strict:
    uv run .github/scripts/validate-experiments.py --strict

# Check the TS types and taxonomy.json still match experiment_schema.py
check-schema-sync:
    uv run .github/scripts/check-schema-sync.py

# Copy the canonical design tokens into the prototype-frontend skill's assets.
# The skill ships copies so it works outside this repo; this is how they stay
# honest. `--check` exits 1 on drift instead of copying.
sync-tokens *ARGS:
    #!/usr/bin/env bash
    set -euo pipefail
    SRC="packages/ui/src/styles"
    DEST=".claude/skills/prototype-frontend/assets/css"
    if [[ ! -d "$DEST" ]]; then
      echo "prototype-frontend skill not present (.claude/ is local-only) — nothing to sync"
      exit 0
    fi
    drift=0
    for f in primitives prototype prototype-light prototype-high-contrast; do
      if [[ "{{ARGS}}" == *--check* ]]; then
        if ! diff -q "$SRC/$f.css" "$DEST/$f.css" >/dev/null 2>&1; then
          echo "DRIFT: $DEST/$f.css differs from $SRC/$f.css"
          drift=1
        fi
      else
        cp "$SRC/$f.css" "$DEST/$f.css"
        echo "synced $f.css"
      fi
    done
    if [[ "$drift" -eq 1 ]]; then
      echo "Run \`just sync-tokens\` to update the skill's copies." >&2
      exit 1
    fi
    [[ "{{ARGS}}" == *--check* ]] && echo "✓ Skill design tokens match packages/ui/src/styles" || true

# Scaffold every template into a throwaway experiment and verify it validates (template regression check)
smoke-scaffold:
    ./.github/scripts/smoke-scaffold.sh

# Capture a learning right now: appends to the brief's ## Learnings section
learning slug text:
    uv run .github/scripts/add-learning.py {{quote(slug)}} {{quote(text)}}

# Sync demo SEO meta (app.html) from the brief's frontmatter — single source of truth
sync-meta:
    uv run .github/scripts/sync-demo-meta.py

# Check demo SEO meta is in sync with the brief (CI parity, exits 1 on drift)
sync-meta-check:
    uv run .github/scripts/sync-demo-meta.py --check


# Check the docs don't lie: every `just` recipe they name exists, every link resolves
check-docs *ARGS:
    python3 .github/scripts/check-docs.py {{ARGS}}

# Check CI can run everything it references (nothing tracked depends on something untracked)
check-committed:
    python3 .github/scripts/check-committed.py

# Health check: metadata + schema sync + gate sweep + docs + demo base paths
doctor:
    #!/usr/bin/env bash
    echo "=== Metadata validation ==="
    uv run .github/scripts/validate-experiments.py --quiet
    echo ""
    echo "=== Schema sync (TS types + taxonomy vs experiment_schema.py) ==="
    uv run .github/scripts/check-schema-sync.py
    echo ""
    echo "=== Coach gate sweep ==="
    uv run .github/scripts/coach-sweep.py
    echo ""
    echo "=== Demo SEO meta in sync ==="
    uv run .github/scripts/sync-demo-meta.py --check
    echo ""
    echo "=== Docs (recipes exist, links resolve) ==="
    python3 .github/scripts/check-docs.py
    echo ""
    echo "=== Committed pipeline is self-contained ==="
    python3 .github/scripts/check-committed.py
    echo ""
    echo "=== Demo base paths (built output, if any) ==="
    just verify-base-paths

# Build all demos (outputs to dist/experiments/). Sync SEO meta first so app.html
# tags always match the brief (mirrors the deploy workflow).
build-demos *ARGS: sync-meta
    ./.github/scripts/build-demos.sh {{ARGS}}

# Full build: validate + index + demos
build-all: validate generate-index build-demos

# ============================================
# Development Helpers
# ============================================

# List all experiments with their status and type
list-experiments:
    uv run .github/scripts/list-experiments.py

# Show experiment counts by type and status
stats:
    uv run .github/scripts/list-experiments.py --stats

# ============================================
# Hub Commands
# ============================================

# Build the Astro hub site. Depends on generate-index: experiment-index.json is
# gitignored, so without it a fresh clone fails on an unexplained ENOENT.
build-hub: generate-index
    cd hub && pnpm install && pnpm build

# Run hub in development mode
dev-hub: generate-index
    cd hub && pnpm install && pnpm dev

# Preview hub build
preview-hub:
    cd hub && pnpm preview

# ============================================
# Full Build Commands
# ============================================

# Test full hub build locally (validates + builds hub + demos)
test-build:
    ./.github/scripts/test-hub-build.sh

# Test build with clean slate
test-build-clean:
    ./.github/scripts/test-hub-build.sh --clean

# Test build and serve locally
test-build-serve:
    ./.github/scripts/test-hub-build.sh --clean --serve

# Clean all build outputs
clean:
    rm -rf dist/
    rm -rf hub/node_modules
    rm -rf experiments/*/demo/node_modules
    echo "Cleaned build outputs"

# ============================================
# CI & Build Helpers
# ============================================

# Build demos with force rebuild (ignore cache)
build-demos-force:
    ./.github/scripts/build-demos.sh dist --force

# Clear build cache to force fresh builds
clear-build-cache:
    rm -rf .build-cache
    echo "Build cache cleared"

# Simulate CI build locally (production paths, workspace install)
ci-build:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== Simulating CI build (production mode) ==="
    unset LOCAL_DEV
    pnpm install --frozen-lockfile
    cd hub && pnpm build
    cd ..
    WORKSPACE_INSTALL=true ./.github/scripts/build-demos.sh dist
    echo ""
    echo "=== CI build complete ==="
    echo "Output in dist/"

# Verify production base paths in built demos (--strict makes drift fatal, as in CI)
verify-base-paths *ARGS:
    ./.github/scripts/verify-base-paths.sh dist {{ARGS}}
