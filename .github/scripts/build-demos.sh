#!/usr/bin/env bash
# Build all demo-enabled experiments and aggregate outputs
#
# Usage: ./.github/scripts/build-demos.sh [output-dir] [options]
#
# Arguments:
#   output-dir  Directory to aggregate demo outputs (default: dist/experiments)
#
# Options:
#   --sequential     Disable parallel builds
#   --force          Force rebuild even if unchanged
#   --only a,b,c     Build only these slugs (PR CI builds just the touched demos)
#
# The script:
# 1. Scans experiments/*/brief.md for demo metadata
# 2. Finds experiments with demo.enabled: true
# 3. Computes hash of source files to detect changes
# 4. Runs builds in parallel (up to 4 concurrent)
# 5. Copies outputs to the aggregation directory

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
EXPERIMENTS_DIR="$REPO_ROOT/experiments"
CACHE_DIR="$REPO_ROOT/.build-cache"

# Environment flag: skip per-demo install if workspace install was done at root
WORKSPACE_INSTALL="${WORKSPACE_INSTALL:-false}"

# Parse arguments
OUTPUT_DIR="$REPO_ROOT/dist/experiments"
PARALLEL=true
FORCE_REBUILD=false
MAX_JOBS=4
# Comma-separated allowlist of slugs. Empty means "every demo-enabled experiment".
# PR CI uses this to build only what the diff touched.
ONLY=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --sequential) PARALLEL=false ;;
        --force) FORCE_REBUILD=true ;;
        --only) ONLY="${2:-}"; shift ;;
        --only=*) ONLY="${1#*=}" ;;
        --*) ;; # Ignore other flags
        *) OUTPUT_DIR="$1" ;;
    esac
    shift
done

# Is this experiment in the --only allowlist?
selected() {
    [[ -z "$ONLY" ]] && return 0
    local slug="$1" want
    IFS=',' read -ra want <<< "$ONLY"
    for w in "${want[@]}"; do
        [[ "$slug" == "${w// /}" ]] && return 0
    done
    return 1
}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
log_build() { echo -e "${BLUE}[BUILD]${NC} $1"; }

# Determine Python command (prefer uv run if available)
PYTHON_CMD="python3"
if command -v uv &>/dev/null; then
    PYTHON_CMD="uv run python"
fi

# Wrap a command with "uv run" when uv is available (for marimo, jupyter, etc.).
#
# Deliberately bare `uv run`, with no `--extra`: this runs with cwd set to the
# experiment directory, and every notebook experiment carries its own
# pyproject.toml declaring marimo/jupyter, so uv resolves the experiment's project
# and gets the right tool. Adding `--extra notebooks` here fails with "Extra
# `notebooks` is not defined" — that extra belongs to the *root* project, which
# isn't the one in scope.
wrap_python_cmd() {
    local cmd="$1"
    if command -v uv &>/dev/null; then
        echo "uv run $cmd"
    else
        echo "$cmd"
    fi
}

# Check for required tools
check_dependencies() {
    local missing=()

    if ! command -v python3 &>/dev/null && ! command -v uv &>/dev/null; then
        missing+=("python3 or uv")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing[*]}"
        exit 1
    fi
}

# Read one metadata value for an experiment. Delegates to experiment_doc.py so
# there is a single implementation of "where does an experiment's metadata live"
# — the brief's YAML frontmatter.
#
# Deliberately NOT swallowing errors: this used to end in `2>/dev/null || echo ""`,
# which turned a parse failure into "demo.enabled is empty", which build_demo()
# reads as "disabled" and returns success for. That combination silently drops
# every demo from the deploy while CI stays green.
get_meta_value() {
    local exp_dir="$1"
    local key="$2"
    $PYTHON_CMD .github/scripts/experiment_doc.py --get "$key" "$exp_dir"
}

# Compute the cache key for a demo: its own sources, every shared package's
# sources, and the build mode.
#
# Two things here are load-bearing and were both bugs once:
#
#  1. Shared packages are discovered, not listed. An earlier version enumerated
#     packages/ui/src and packages/byo-keys/*/src by hand and therefore missed
#     packages/llm-lab/src entirely — so llm-lab changes silently reused stale
#     demo builds, and CI could publish demos built against an older llm-lab.
#     Anything under packages/ counts now, so a new package can't be forgotten.
#
#  2. The build mode is part of the key. SvelteKit bakes the base path in at
#     build time ('' for LOCAL_DEV, /applied-ai-experiments/<slug> otherwise), so
#     a dist built in one mode is NOT interchangeable with the other. Without
#     this, a cache hit could hand a production-path build to a local dev server,
#     where every asset 404s and the page renders blank.
compute_demo_hash() {
    local demo_dir="$1"

    if [[ ! -d "$demo_dir" ]]; then
        echo "no-source"
        return
    fi

    # Note the two-stage hash: the block below emits NUL-separated *filenames*
    # that xargs feeds to cat, so the build mode cannot be echoed into that
    # stream — it would be read as a filename, silently dropped, and would
    # corrupt the first real entry. Hash the file contents first, then fold the
    # mode in afterwards.
    local files_hash
    files_hash=$(
    {
        find "$demo_dir" -type f \
            \( -name "*.svelte" -o -name "*.ts" -o -name "*.js" -o -name "*.css" \
               -o -name "*.html" -o -name "package.json" -o -name "*.json" -o -name "*.py" \) \
            -not -path "*/node_modules/*" \
            -not -path "*/.svelte-kit/*" \
            -not -path "*/dist/*" \
            -not -path "*/.build/*" \
            -print0 2>/dev/null

        # Every shared package's sources — see (1) above.
        find "$REPO_ROOT/packages" -type f \
            \( -name "*.svelte" -o -name "*.ts" -o -name "*.js" -o -name "*.css" \
               -o -name "*.html" -o -name "*.json" \) \
            -not -path "*/node_modules/*" \
            -not -path "*/.svelte-kit/*" \
            -not -path "*/dist/*" \
            -not -path "*/.build/*" \
            -print0 2>/dev/null
    } | \
        sort -z | \
        xargs -0 cat 2>/dev/null | \
        shasum -a 256 | \
        cut -d' ' -f1
    )

    # Fold in the build mode — see (2) above.
    #
    # Deliberately folded into the single hash VALUE rather than kept as separate
    # per-mode cache files. Per-mode caching looks like a free optimisation and is
    # actually unsound: both modes build into the same `demo/dist`, so a cache hit
    # for one mode can copy output the other mode wrote last. One key per
    # experiment means switching modes always rebuilds — which is necessary here,
    # not wasteful, because there is only one output directory to be correct.
    printf 'LOCAL_DEV=%s\n%s\n' "${LOCAL_DEV:-}" "$files_hash" | \
        shasum -a 256 | \
        cut -d' ' -f1
}

# Check if rebuild is needed
needs_rebuild() {
    local exp_name="$1"
    local demo_dir="$2"

    if [[ "$FORCE_REBUILD" == "true" ]]; then
        return 0  # true - needs rebuild
    fi

    local cache_file="$CACHE_DIR/$exp_name.hash"
    local current_hash
    current_hash=$(compute_demo_hash "$demo_dir")

    if [[ -f "$cache_file" ]]; then
        local cached_hash
        cached_hash=$(cat "$cache_file")
        if [[ "$current_hash" == "$cached_hash" ]]; then
            return 1  # false - no rebuild needed
        fi
    fi

    return 0  # true - needs rebuild
}

# Save hash after successful build
save_hash() {
    local exp_name="$1"
    local demo_dir="$2"

    mkdir -p "$CACHE_DIR"
    compute_demo_hash "$demo_dir" > "$CACHE_DIR/$exp_name.hash"
}

# Build a single experiment demo
# Returns 0 on success, 1 on failure, 2 if skipped (no changes)
build_demo() {
    local exp_dir="$1"
    local exp_name="$2"
    local log_file="${3:-/dev/null}"

    local demo_enabled demo_type build_cmd output_subdir
    demo_enabled=$(get_meta_value "$exp_dir" "demo.enabled")

    if [[ "$demo_enabled" != "True" && "$demo_enabled" != "true" ]]; then
        return 0
    fi

    demo_type=$(get_meta_value "$exp_dir" "demo.type")
    build_cmd=$(get_meta_value "$exp_dir" "demo.build_command")
    output_subdir=$(get_meta_value "$exp_dir" "demo.output_dir")

    # Default values
    demo_type="${demo_type:-static}"
    output_subdir="${output_subdir:-demo/dist}"

    local demo_src="$exp_dir/$output_subdir"

    # Route notebook types to notebook/ subdirectory
    local notebook_types="notebook-html marimo-html marimo-wasm"
    local demo_dest
    if echo "$notebook_types" | grep -qw "$demo_type"; then
        demo_dest="$OUTPUT_DIR/notebook/$exp_name"
    else
        demo_dest="$OUTPUT_DIR/$exp_name"
    fi

    local demo_dir="$exp_dir/demo"

    # Check if rebuild is needed (for JS projects).
    # A cache hit is only usable if there is actually output to reuse — otherwise
    # the skip path copies nothing and the demo serves as a blank page. Missing
    # output therefore forces a rebuild regardless of the hash.
    if [[ "$demo_type" == "sveltekit" || "$demo_type" == "astro" ]]; then
        if [[ -d "$demo_src" ]] && ! needs_rebuild "$exp_name" "$demo_dir"; then
            echo "[SKIP] $exp_name - no changes detected" >> "$log_file"
            mkdir -p "$demo_dest"
            cp -r "$demo_src"/* "$demo_dest"/ 2>/dev/null || true
            return 2  # skipped
        fi
    fi

    echo "[BUILD] Starting: $exp_name" >> "$log_file"

    # Build based on type
    case "$demo_type" in
        sveltekit|astro)
            if [[ -n "$build_cmd" ]]; then
                if [[ -f "$demo_dir/package.json" ]]; then
                    # Skip install if workspace install was done at root
                    if [[ "$WORKSPACE_INSTALL" != "true" ]]; then
                        echo "[BUILD] $exp_name: Installing dependencies..." >> "$log_file"
                        if ! (cd "$demo_dir" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install) >> "$log_file" 2>&1; then
                            echo "[ERROR] $exp_name: Failed to install dependencies" >> "$log_file"
                            return 1
                        fi
                    else
                        echo "[BUILD] $exp_name: Skipping install (workspace mode)..." >> "$log_file"
                    fi

                    echo "[BUILD] $exp_name: Running $build_cmd" >> "$log_file"
                    if ! (cd "$demo_dir" && LOCAL_DEV="${LOCAL_DEV:-}" eval "$build_cmd") >> "$log_file" 2>&1; then
                        echo "[ERROR] $exp_name: Build command failed" >> "$log_file"
                        return 1
                    fi

                    # Save hash on successful build
                    save_hash "$exp_name" "$demo_dir"
                else
                    echo "[ERROR] $exp_name: No package.json found" >> "$log_file"
                    return 1
                fi
            fi
            ;;
        notebook-html)
            if [[ -n "$build_cmd" ]]; then
                echo "[BUILD] $exp_name: Running $build_cmd" >> "$log_file"
                if ! (cd "$exp_dir" && eval "$(wrap_python_cmd "$build_cmd")") >> "$log_file" 2>&1; then
                    echo "[ERROR] $exp_name: Notebook export failed" >> "$log_file"
                    return 1
                fi
            fi
            ;;
        marimo-html)
            if [[ -n "$build_cmd" ]]; then
                echo "[BUILD] $exp_name: Running $build_cmd" >> "$log_file"
                if ! (cd "$exp_dir" && eval "$(wrap_python_cmd "$build_cmd")") >> "$log_file" 2>&1; then
                    echo "[ERROR] $exp_name: Marimo HTML export failed" >> "$log_file"
                    return 1
                fi
            fi
            ;;
        marimo-wasm)
            if [[ -n "$build_cmd" ]]; then
                echo "[BUILD] $exp_name: Running $build_cmd" >> "$log_file"
                if ! (cd "$exp_dir" && eval "$(wrap_python_cmd "$build_cmd")") >> "$log_file" 2>&1; then
                    echo "[ERROR] $exp_name: Marimo WASM export failed" >> "$log_file"
                    return 1
                fi
            fi
            ;;
        static)
            echo "[BUILD] $exp_name: Static demo, no build needed" >> "$log_file"
            ;;
        *)
            echo "[ERROR] $exp_name: Unknown demo type: $demo_type" >> "$log_file"
            return 1
            ;;
    esac

    # Copy output to aggregated directory
    if [[ -d "$demo_src" ]]; then
        echo "[BUILD] $exp_name: Copying output to $demo_dest" >> "$log_file"
        mkdir -p "$demo_dest"
        cp -r "$demo_src"/* "$demo_dest"/ 2>/dev/null || {
            echo "[WARN] $exp_name: No files to copy" >> "$log_file"
        }
        echo "[SUCCESS] $exp_name: Build complete" >> "$log_file"
        return 0
    else
        echo "[ERROR] $exp_name: Output not found at $demo_src" >> "$log_file"
        return 1
    fi
}

# Wait for a job slot to become available
wait_for_slot() {
    while [[ $(jobs -rp | wc -l) -ge $MAX_JOBS ]]; do
        sleep 0.5
    done
}

main() {
    check_dependencies

    log_info "Building demos..."
    log_info "Output directory: $OUTPUT_DIR"
    log_info "Parallel builds: $PARALLEL (max $MAX_JOBS concurrent)"
    log_info "Force rebuild: $FORCE_REBUILD"

    mkdir -p "$OUTPUT_DIR"
    mkdir -p "$CACHE_DIR"

    # Create temp directory for logs and tracking
    local log_dir
    log_dir=$(mktemp -d)
    trap "rm -rf $log_dir" EXIT

    # Collect demos to build - store as "name:yaml_path" pairs
    local demos_list="$log_dir/demos.txt"
    : > "$demos_list"

    for exp_dir in "$EXPERIMENTS_DIR"/*/; do
        [[ -d "$exp_dir" ]] || continue

        local exp_name
        exp_name=$(basename "$exp_dir")

        # Skip hidden directories
        [[ "$exp_name" == .* ]] && continue

        # All metadata lives in the brief's frontmatter.
        if [[ ! -f "$exp_dir/brief.md" ]]; then
            continue
        fi

        selected "$exp_name" || continue

        # Check if demo is enabled
        local demo_enabled
        demo_enabled=$(get_meta_value "$exp_dir" "demo.enabled")

        if [[ "$demo_enabled" == "True" || "$demo_enabled" == "true" ]]; then
            echo "$exp_name" >> "$demos_list"
        fi
    done

    local total
    total=$(wc -l < "$demos_list" | tr -d ' ')
    log_info "Found $total demo-enabled experiments"

    if [[ $total -eq 0 ]]; then
        log_info "No demos to build"
        exit 0
    fi

    # Track results
    local built=0
    local failed=0
    local skipped=0
    local failed_demos=""
    local pids_file="$log_dir/pids.txt"
    : > "$pids_file"

    if [[ "$PARALLEL" == "true" ]]; then
        # Parallel execution
        log_info "Starting parallel builds..."

        while read -r exp_name; do
            wait_for_slot

            local exp_dir="$EXPERIMENTS_DIR/$exp_name"
            local log_file="$log_dir/$exp_name.log"

            log_build "Starting: $exp_name"

            # Run build in background
            (build_demo "$exp_dir" "$exp_name" "$log_file") &
            echo "$!:$exp_name" >> "$pids_file"
        done < "$demos_list"

        # Wait for all jobs and collect results
        while IFS=: read -r pid exp_name; do
            local log_file="$log_dir/$exp_name.log"

            if wait "$pid" 2>/dev/null; then
                # Check if it was skipped (exit code captured via log)
                if grep -q "\[SKIP\]" "$log_file" 2>/dev/null; then
                    log_info "Skipped: $exp_name (no changes)"
                    ((skipped++)) || true
                else
                    log_info "Built: $exp_name"
                    ((built++)) || true
                fi
            else
                local exit_code=$?
                if [[ $exit_code -eq 2 ]]; then
                    log_info "Skipped: $exp_name (no changes)"
                    ((skipped++)) || true
                else
                    log_error "Failed: $exp_name"
                    failed_demos="$failed_demos $exp_name"
                    ((failed++)) || true
                    # Show error from log
                    if [[ -f "$log_file" ]]; then
                        echo "--- Error log for $exp_name ---"
                        tail -20 "$log_file"
                        echo "---"
                    fi
                fi
            fi
        done < "$pids_file"
    else
        # Sequential execution
        while read -r exp_name; do
            local exp_dir="$EXPERIMENTS_DIR/$exp_name"
            local log_file="$log_dir/$exp_name.log"

            log_build "Building: $exp_name"

            if build_demo "$exp_dir" "$exp_name" "$log_file"; then
                if grep -q "\[SKIP\]" "$log_file" 2>/dev/null; then
                    log_info "Skipped: $exp_name (no changes)"
                    ((skipped++)) || true
                else
                    log_info "Built: $exp_name"
                    ((built++)) || true
                fi
            else
                local exit_code=$?
                if [[ $exit_code -eq 2 ]]; then
                    log_info "Skipped: $exp_name (no changes)"
                    ((skipped++)) || true
                else
                    log_error "Failed: $exp_name"
                    failed_demos="$failed_demos $exp_name"
                    ((failed++)) || true
                fi
            fi
        done < "$demos_list"
    fi

    echo ""
    log_info "Demo build complete"
    log_info "  Built: $built"
    log_info "  Skipped: $skipped (unchanged)"
    log_info "  Failed: $failed"

    if [[ -n "$failed_demos" ]]; then
        log_error "Failed demos:$failed_demos"
    fi

    if [[ $built -gt 0 || $skipped -gt 0 ]]; then
        echo ""
        log_info "Outputs in: $OUTPUT_DIR"
        ls -la "$OUTPUT_DIR" 2>/dev/null || true
    fi

    if [[ $failed -gt 0 ]]; then
        exit 1
    fi
}

main "$@"
