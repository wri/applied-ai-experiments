set quiet := true
# justfile
# Run: `just new-experiment`
# Or:  `just new-experiment name=my-run template=experiment-minimal`

set shell := ["bash", "-euo", "pipefail", "-c"]


EXPERIMENTS_DIR := "experiments"
TEMPLATES_DIR   := ".github/templates"
# ============================================
# Setup Commands
# ============================================

# Prints one template name per line.
@list-templates:
    #!/usr/bin/env bash
    if [[ ! -d "{{TEMPLATES_DIR}}" ]]; then
      echo "No templates directory found at '{{TEMPLATES_DIR}}'." >&2
      exit 1
    fi
    # Collect names using BSD/GNU-compatible flags
    LIST="$(find "{{TEMPLATES_DIR}}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null | LC_ALL=C sort)"
    if [[ -z "$LIST" ]]; then
      echo "No templates found under '{{TEMPLATES_DIR}}'." >&2
      exit 1
    fi
    printf "Available templates:\n"
    printf "  - %s\n" $LIST

@new-experiment name='' template='':
    #!/usr/bin/env bash
    # Ensure base dirs exist
    [[ -d "{{TEMPLATES_DIR}}" ]] || { echo "Missing '{{TEMPLATES_DIR}}' directory." >&2; exit 1; }
    mkdir -p "{{EXPERIMENTS_DIR}}"

    # Function to get template description
    get_template_desc() {
      case "$1" in
        micro) echo "Quick exploration (< 1 day)" ;;
        spike) echo "Time-boxed investigation (1-2 days)" ;;
        prototype) echo "Interactive demo with SvelteKit" ;;
        evaluation) echo "Formal comparison with metrics" ;;
        benchmark) echo "Dataset-based model evaluation" ;;
        research) echo "User research with interviews" ;;
        notebook) echo "Jupyter notebook exploration" ;;
        marimo) echo "Marimo notebook exploration" ;;
        experiment-minimal) echo "Basic experiment structure" ;;
        *) echo "" ;;
      esac
    }

    # Function to list templates (one per line)
    templates_list() {
      find "{{TEMPLATES_DIR}}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null | LC_ALL=C sort
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

    # Validate chosen template
    SRC="{{TEMPLATES_DIR}}/$SELECTED_TEMPLATE"
    if [[ ! -d "$SRC" ]]; then
      echo "Template '$SELECTED_TEMPLATE' not found in '{{TEMPLATES_DIR}}'." >&2
      echo "Available: ${TEMPLATES[*]}" >&2
      exit 1
    fi

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

    # Copy template into destination (preserve dotfiles)
    mkdir -p "$DEST"
    shopt -s dotglob nullglob
    if command -v rsync >/dev/null 2>&1; then
      rsync -a "$SRC"/ "$DEST"/
    else
      cp -R "$SRC"/* "$DEST"/ || true  # ok if template is empty
    fi

    # Auto-populate slug and dates in info.yaml
    TODAY="$(date +%Y-%m-%d)"
    if [[ -f "$DEST/info.yaml" ]]; then
      # Use sed to replace placeholders (macOS compatible)
      sed -i '' "s/slug: CHANGEME/slug: $NAME/g" "$DEST/info.yaml" 2>/dev/null || \
        sed -i "s/slug: CHANGEME/slug: $NAME/g" "$DEST/info.yaml"
      sed -i '' "s/slug: spike-CHANGEME/slug: $NAME/g" "$DEST/info.yaml" 2>/dev/null || \
        sed -i "s/slug: spike-CHANGEME/slug: $NAME/g" "$DEST/info.yaml"
      sed -i '' "s/YYYY-MM-DD/$TODAY/g" "$DEST/info.yaml" 2>/dev/null || \
        sed -i "s/YYYY-MM-DD/$TODAY/g" "$DEST/info.yaml"
    fi

    # Auto-populate slug in svelte.config.js for prototype template
    if [[ -f "$DEST/demo/svelte.config.js" ]]; then
      sed -i '' "s/proto-CHANGEME/$NAME/g" "$DEST/demo/svelte.config.js" 2>/dev/null || \
        sed -i "s/proto-CHANGEME/$NAME/g" "$DEST/demo/svelte.config.js"
    fi

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
    echo "  cd \"$DEST\""
    echo "  # Edit info.yaml - slug and dates are pre-filled"
    echo "  # Update the CHANGEME placeholders"
    echo "  # See docs/metadata-schema.md for all available fields"

# ============================================
# Experiment Management Commands
# ============================================

# Generate the experiment index from all info.yaml files
generate-index:
    python .github/scripts/generate-index.py

# Validate all experiment metadata
validate:
    python .github/scripts/validate-experiments.py

# Validate strictly (warnings become errors)
validate-strict:
    python .github/scripts/validate-experiments.py --strict

# Build all demos (outputs to dist/experiments/)
build-demos:
    ./.github/scripts/build-demos.sh

# Full build: validate + index + demos
build-all: validate generate-index build-demos

# Update README with experiment table
update-readme:
    python .github/scripts/update_readme.py

# ============================================
# Development Helpers
# ============================================

# List all experiments with their status
list-experiments:
    @python -c "import yaml; from pathlib import Path; \
    [print(f\"{d.name}: {yaml.safe_load((d/'info.yaml').open()).get('status', 'unknown') if (d/'info.yaml').exists() else yaml.safe_load((d/'experiment.yaml').open()).get('status', 'unknown') if (d/'experiment.yaml').exists() else 'no metadata'}\") \
    for d in sorted(Path('experiments').iterdir()) if d.is_dir() and not d.name.startswith('.')]"

# Show experiment types and counts
stats:
    @python -c "import yaml; from pathlib import Path; from collections import Counter; \
    types = Counter(); \
    [types.update([yaml.safe_load((d/'info.yaml').open()).get('type', 'unknown')]) \
    for d in Path('experiments').iterdir() if d.is_dir() and (d/'info.yaml').exists()]; \
    [types.update([yaml.safe_load((d/'experiment.yaml').open()).get('type', 'unknown')]) \
    for d in Path('experiments').iterdir() if d.is_dir() and not (d/'info.yaml').exists() and (d/'experiment.yaml').exists()]; \
    print('Experiments by type:'); \
    [print(f'  {t}: {c}') for t, c in sorted(types.items())]"

# ============================================
# Hub Commands
# ============================================

# Build the Astro hub site
build-hub:
    cd hub && pnpm install && pnpm build

# Run hub in development mode
dev-hub:
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
    @echo "Cleaned build outputs"

# ============================================
# CI & Build Helpers
# ============================================

# Build demos with force rebuild (ignore cache)
build-demos-force:
    ./.github/scripts/build-demos.sh dist --force

# Clear build cache to force fresh builds
clear-build-cache:
    rm -rf .build-cache
    @echo "Build cache cleared"

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

# Verify production base paths in built demos
verify-base-paths:
    #!/usr/bin/env bash
    echo "Checking base paths in built demos..."
    found=0
    for dir in dist/*/; do
      [[ -d "$dir" ]] || continue
      name=$(basename "$dir")
      # Skip non-demo directories
      [[ "$name" == "hub" ]] && continue
      [[ -f "$dir/index.html" ]] || continue
      found=1
      if grep -q "/applied-ai-experiments/$name" "$dir/index.html" 2>/dev/null; then
        echo "  ✓ $name: production path"
      elif grep -q "base.*'/$name" "$dir/_app/"*.js 2>/dev/null; then
        echo "  ~ $name: local dev path (run 'just ci-build' for production)"
      else
        echo "  ✗ $name: path unclear (check manually)"
      fi
    done
    [[ $found -eq 0 ]] && echo "  No demos found in dist/"
