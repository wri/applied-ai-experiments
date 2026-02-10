#!/usr/bin/env bash
# Build all demo-enabled experiments and aggregate outputs
#
# Usage: ./.github/scripts/build-demos.sh [output-dir] [options]
#
# Arguments:
#   output-dir  Directory to aggregate demo outputs (default: dist/experiments)
#
# Options:
#   --sequential   Disable parallel builds
#   --force        Force rebuild even if unchanged
#
# The script:
# 1. Scans experiments/*/info.yaml (or experiment.yaml for migration)
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

for arg in "$@"; do
    case "$arg" in
        --sequential) PARALLEL=false ;;
        --force) FORCE_REBUILD=true ;;
        --*) ;; # Ignore other flags
        *) OUTPUT_DIR="$arg" ;;
    esac
done

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

# Wrap a command with "uv run" when uv is available (for marimo, jupyter, etc.)
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

# Extract YAML value using Python (portable, no yq dependency)
get_yaml_value() {
    local file="$1"
    local key="$2"
    $PYTHON_CMD -c "
import yaml
import sys
with open('$file') as f:
    data = yaml.safe_load(f)
# Navigate nested keys like 'demo.enabled'
keys = '$key'.split('.')
val = data
for k in keys:
    if isinstance(val, dict):
        val = val.get(k)
    else:
        val = None
        break
if val is not None:
    print(val)
" 2>/dev/null || echo ""
}

# Compute hash of demo source files
compute_demo_hash() {
    local demo_dir="$1"

    if [[ ! -d "$demo_dir" ]]; then
        echo "no-source"
        return
    fi

    # Hash relevant source files (excluding node_modules, .svelte-kit, dist)
    find "$demo_dir" -type f \
        \( -name "*.svelte" -o -name "*.ts" -o -name "*.js" -o -name "*.css" \
           -o -name "*.html" -o -name "package.json" -o -name "*.json" -o -name "*.py" \) \
        -not -path "*/node_modules/*" \
        -not -path "*/.svelte-kit/*" \
        -not -path "*/dist/*" \
        -not -path "*/.build/*" \
        -print0 2>/dev/null | \
        sort -z | \
        xargs -0 cat 2>/dev/null | \
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
    local yaml_file="$3"
    local log_file="${4:-/dev/null}"

    local demo_enabled demo_type build_cmd output_subdir
    demo_enabled=$(get_yaml_value "$yaml_file" "demo.enabled")

    if [[ "$demo_enabled" != "True" && "$demo_enabled" != "true" ]]; then
        return 0
    fi

    demo_type=$(get_yaml_value "$yaml_file" "demo.type")
    build_cmd=$(get_yaml_value "$yaml_file" "demo.build_command")
    output_subdir=$(get_yaml_value "$yaml_file" "demo.output_dir")

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

    # Check if rebuild is needed (for JS projects)
    if [[ "$demo_type" == "sveltekit" || "$demo_type" == "astro" ]]; then
        if ! needs_rebuild "$exp_name" "$demo_dir"; then
            echo "[SKIP] $exp_name - no changes detected" >> "$log_file"
            # Still copy existing output if it exists
            if [[ -d "$demo_src" ]]; then
                mkdir -p "$demo_dest"
                cp -r "$demo_src"/* "$demo_dest"/ 2>/dev/null || true
            fi
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

        # Find metadata file
        local yaml_file=""
        if [[ -f "$exp_dir/info.yaml" ]]; then
            yaml_file="$exp_dir/info.yaml"
        elif [[ -f "$exp_dir/experiment.yaml" ]]; then
            yaml_file="$exp_dir/experiment.yaml"
        else
            continue
        fi

        # Check if demo is enabled
        local demo_enabled
        demo_enabled=$(get_yaml_value "$yaml_file" "demo.enabled")

        if [[ "$demo_enabled" == "True" || "$demo_enabled" == "true" ]]; then
            echo "$exp_name:$yaml_file" >> "$demos_list"
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

        while IFS=: read -r exp_name yaml_file; do
            wait_for_slot

            local exp_dir="$EXPERIMENTS_DIR/$exp_name"
            local log_file="$log_dir/$exp_name.log"

            log_build "Starting: $exp_name"

            # Run build in background
            (build_demo "$exp_dir" "$exp_name" "$yaml_file" "$log_file") &
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
        while IFS=: read -r exp_name yaml_file; do
            local exp_dir="$EXPERIMENTS_DIR/$exp_name"
            local log_file="$log_dir/$exp_name.log"

            log_build "Building: $exp_name"

            if build_demo "$exp_dir" "$exp_name" "$yaml_file" "$log_file"; then
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
