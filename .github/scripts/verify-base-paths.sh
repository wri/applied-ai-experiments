#!/usr/bin/env bash
# Verify built demos baked in the production base path.
#
# Usage: ./.github/scripts/verify-base-paths.sh [dist-dir] [--strict]
#
# Why this check exists: SvelteKit bakes the base path in at build time — '' for
# LOCAL_DEV, /applied-ai-experiments/<slug> otherwise. A demo built in the wrong
# mode builds green and then serves a blank page, because every asset 404s. The
# build cannot detect this; only the output can.
#
# --strict turns "built with the local dev path" and "path unclear" into failures.
# CI uses it; `just doctor` doesn't, because locally a dev-path build is normal.
set -euo pipefail

cd "$(dirname "$0")/../.."

DIST="dist"
STRICT=false
for arg in "$@"; do
    case "$arg" in
        --strict) STRICT=true ;;
        --*) ;;
        *) DIST="$arg" ;;
    esac
done

echo "Checking base paths in built demos under $DIST/..."
found=0
problems=0

for dir in "$DIST"/*/; do
    [[ -d "$dir" ]] || continue
    name=$(basename "$dir")
    # A built demo is SvelteKit static output: index.html *plus* _app/. The hub
    # builds into this same dist/ root and puts its assets in _assets/, so its
    # route directories (themes/, learnings/, and the meta-refresh redirect stubs
    # for /demos, /portfolio, /insights) have an index.html but no _app/. Testing
    # for _app/ separates demos from hub pages structurally; a name blocklist has
    # to be updated every time the hub grows a route, and the redirect stubs can
    # never contain their own base path anyway.
    [[ -f "$dir/index.html" && -d "$dir/_app" ]] || continue
    found=1

    if grep -q "/applied-ai-experiments/$name" "$dir/index.html" 2>/dev/null; then
        echo "  ✓ $name: production path"
    elif grep -q "base.*'/$name" "$dir"/_app/*.js 2>/dev/null; then
        echo "  ~ $name: local dev path (run 'just ci-build' for production)"
        [[ "$STRICT" == "true" ]] && problems=$((problems + 1))
    else
        echo "  ✗ $name: path unclear (check manually)"
        [[ "$STRICT" == "true" ]] && problems=$((problems + 1))
    fi
done

if [[ $found -eq 0 ]]; then
    echo "  No demos found in $DIST/"
    exit 0
fi

if [[ $problems -gt 0 ]]; then
    echo "$problems demo(s) did not bake the production base path." >&2
    exit 1
fi
