#!/usr/bin/env bash
# Scaffold every template into experiments/zz-smoke-<template>, fill metadata the
# same way `just new-experiment` does, and check the result passes validation and
# the demo SEO sync check with zero hand edits. Throwaway experiments are removed
# on exit. Used by `just smoke-scaffold` and the smoke-scaffold CI job.
set -euo pipefail

cd "$(dirname "$0")/../.."

cleanup() { rm -rf experiments/zz-smoke-*; }
trap cleanup EXIT

if command -v uv >/dev/null 2>&1; then
  RUN=(uv run python)
else
  RUN=(python3)
fi

for t in $("${RUN[@]}" .github/scripts/scaffold_template.py --list); do
  slug="zz-smoke-$t"
  echo "==> scaffolding '$t' as experiments/$slug"
  rm -rf "experiments/$slug"
  "${RUN[@]}" .github/scripts/scaffold_template.py --template "$t" --dest "experiments/$slug"
  # Pass exactly what `just new-experiment` passes, so this smoke-tests the real
  # scaffold path. `--targets` is part of that: templates ship it empty and the
  # strict validation below treats a missing one as an error.
  "${RUN[@]}" .github/scripts/fill-metadata.py "experiments/$slug" \
    --title "Smoke test: $t" \
    --description "Throwaway scaffold used to smoke-test the $t template." \
    --targets infra
done

echo "==> validating all experiments (including smoke scaffolds), warnings fatal"
"${RUN[@]}" .github/scripts/validate-experiments.py --strict

echo "==> checking demo SEO meta is in sync"
"${RUN[@]}" .github/scripts/sync-demo-meta.py --check


echo "OK: every template scaffolds to a validating experiment with no hand edits"
