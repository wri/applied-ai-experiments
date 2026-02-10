#!/usr/bin/env bash
# Test the complete hub build process locally
#
# Usage: ./.github/scripts/test-hub-build.sh [--clean] [--serve]
#
# Options:
#   --clean   Remove dist/ before building
#   --serve   Start a local server after build
#
# This script:
# 1. Validates experiment metadata
# 2. Generates experiment-index.json
# 3. Builds the Astro hub site
# 4. Builds experiment demos (via build-demos.sh)
# 5. Aggregates outputs to dist/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST_DIR="$REPO_ROOT/dist"
HUB_DIR="$REPO_ROOT/hub"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
log_step() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

# Parse arguments
CLEAN=false
SERVE=false
for arg in "$@"; do
    case $arg in
        --clean) CLEAN=true ;;
        --serve) SERVE=true ;;
        --help|-h)
            echo "Usage: $0 [--clean] [--serve]"
            echo ""
            echo "Test the complete hub build process locally."
            echo ""
            echo "Options:"
            echo "  --clean  Remove dist/ before building"
            echo "  --serve  Start a local server after build"
            echo ""
            echo "This script:"
            echo "  1. Validates experiment metadata"
            echo "  2. Generates experiment-index.json"
            echo "  3. Builds the Astro hub site"
            echo "  4. Builds experiment demos"
            echo "  5. Aggregates outputs to dist/"
            exit 0
            ;;
    esac
done

# Check dependencies
check_dependencies() {
    log_step "Checking dependencies"

    local missing=()

    command -v python3 &>/dev/null || missing+=("python3")
    command -v node &>/dev/null || missing+=("node")
    command -v pnpm &>/dev/null || missing+=("pnpm")

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing[*]}"
        echo ""
        echo "Please install the missing tools:"
        for tool in "${missing[@]}"; do
            case $tool in
                python3) echo "  - python3: https://www.python.org/downloads/" ;;
                node) echo "  - node: https://nodejs.org/" ;;
                pnpm) echo "  - pnpm: npm install -g pnpm" ;;
            esac
        done
        exit 1
    fi

    # Check versions
    local node_version
    node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $node_version -lt 20 ]]; then
        log_warn "Node.js v$node_version detected, v20+ recommended"
    fi

    # Check for uv (Python package manager)
    if command -v uv &>/dev/null; then
        log_info "Using uv for Python package management"
    else
        log_warn "uv not found - Python scripts will use system Python"
        # Check for PyYAML when not using uv
        if ! python3 -c "import yaml" 2>/dev/null; then
            log_error "PyYAML not found. Please install it: pip install pyyaml"
            exit 1
        fi
    fi

    log_info "All dependencies available"
}

# Clean dist directory
clean_dist() {
    if [[ "$CLEAN" == "true" ]]; then
        log_step "Cleaning dist directory"
        rm -rf "$DIST_DIR"
        log_info "Removed $DIST_DIR"
    fi
}

# Run Python script (use uv run if available)
run_python() {
    if command -v uv &>/dev/null; then
        uv run python "$@"
    else
        python3 "$@"
    fi
}

# Validate experiments
validate_experiments() {
    log_step "Validating experiment metadata"

    if [[ -f "$REPO_ROOT/.github/scripts/validate-experiments.py" ]]; then
        run_python "$REPO_ROOT/.github/scripts/validate-experiments.py" || {
            log_error "Validation failed"
            exit 1
        }
    else
        log_warn "validate-experiments.py not found, skipping validation"
    fi
}

# Generate experiment index
generate_index() {
    log_step "Generating experiment index"

    if [[ -f "$REPO_ROOT/.github/scripts/generate-index.py" ]]; then
        run_python "$REPO_ROOT/.github/scripts/generate-index.py" || {
            log_error "Index generation failed"
            exit 1
        }
    else
        log_error "generate-index.py not found"
        exit 1
    fi
}

# Build hub site
build_hub() {
    log_step "Building Astro hub site"

    if [[ ! -f "$HUB_DIR/package.json" ]]; then
        log_error "Hub package.json not found at $HUB_DIR/package.json"
        exit 1
    fi

    cd "$HUB_DIR"

    # Install dependencies if needed
    if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules" ]]; then
        log_info "Installing hub dependencies..."
        pnpm install
    fi

    # Build the site with LOCAL_DEV=true for local testing
    log_info "Running Astro build (LOCAL_DEV=true)..."
    LOCAL_DEV=true pnpm build || {
        log_error "Hub build failed"
        exit 1
    }

    cd "$REPO_ROOT"

    # Copy experiment-index.json to dist root (where hub outputs for local dev)
    if [[ -f "$REPO_ROOT/experiment-index.json" ]]; then
        cp "$REPO_ROOT/experiment-index.json" "$DIST_DIR/"
        log_info "Copied experiment-index.json to dist"
    fi

    log_info "Hub built successfully to $DIST_DIR/"
}

# Sync Python dependencies (matches CI's uv sync --group notebooks)
sync_python_deps() {
    log_step "Syncing Python dependencies"
    if command -v uv &>/dev/null; then
        uv sync --extra notebooks 2>&1 || log_warn "uv sync failed, continuing..."
    else
        log_warn "uv not found - skipping Python dependency sync"
    fi
}

# Build experiment demos
build_demos() {
    log_step "Building experiment demos"

    if [[ -f "$REPO_ROOT/.github/scripts/build-demos.sh" ]]; then
        chmod +x "$REPO_ROOT/.github/scripts/build-demos.sh"
        # Pass LOCAL_DEV=true for local testing
        LOCAL_DEV=true "$REPO_ROOT/.github/scripts/build-demos.sh" "$DIST_DIR" || {
            log_warn "Some demos may have failed to build"
        }
    else
        log_warn "build-demos.sh not found, skipping demo builds"
    fi
}

# Final aggregation
aggregate_outputs() {
    log_step "Aggregating outputs"

    # Ensure dist structure exists
    mkdir -p "$DIST_DIR"

    # For local dev, hub outputs directly to dist/ so no redirect needed
    # Just verify the structure
    if [[ -f "$DIST_DIR/index.html" ]]; then
        log_info "Hub index.html found at dist root"
    else
        log_warn "Hub index.html not found at dist root"
    fi

    # List final structure
    log_info "Final dist structure:"
    if command -v tree &>/dev/null; then
        tree -L 3 "$DIST_DIR" 2>/dev/null || find "$DIST_DIR" -maxdepth 3 -type f | head -30
    else
        find "$DIST_DIR" -maxdepth 3 -type f | head -30
    fi
}

# Serve locally
serve_local() {
    if [[ "$SERVE" == "true" ]]; then
        log_step "Starting local server"
        log_info "Serving dist/ at http://localhost:8080"
        log_info "Press Ctrl+C to stop"

        cd "$DIST_DIR"
        local port=8080
        # Find an available port if the default is in use
        while python3 -c "import socket; s=socket.socket(); s.bind(('',${port})); s.close()" 2>/dev/null; [ $? -ne 0 ]; do
            log_warn "Port $port in use, trying $((port+1))..."
            ((port++))
            if [[ $port -gt 8099 ]]; then
                log_error "No available port found in range 8080-8099"
                exit 1
            fi
        done
        log_info "Serving dist/ at http://localhost:$port"
        if command -v python3 &>/dev/null; then
            python3 -m http.server "$port"
        elif command -v npx &>/dev/null; then
            npx serve -l "$port"
        else
            log_error "No server available (need python3 or npx)"
            exit 1
        fi
    fi
}

# Main execution
main() {
    echo ""
    log_info "Starting hub build test"
    log_info "Repository root: $REPO_ROOT"
    echo ""

    check_dependencies
    clean_dist
    validate_experiments
    generate_index
    build_hub
    sync_python_deps
    build_demos
    aggregate_outputs

    log_step "Build Complete"
    log_info "Output directory: $DIST_DIR"
    echo ""
    log_info "To preview locally:"
    log_info "  cd dist && python3 -m http.server 8080"
    log_info "  Then visit: http://localhost:8080/"
    echo ""

    serve_local
}

main "$@"
