#!/usr/bin/env bash
# Re-vendors the woff2 subsets we ship from the @fontsource-variable/*
# devDependencies into client/public/fonts/.
#
# Run this after bumping any @fontsource-variable/* package. If the upstream
# unicode-ranges changed, regenerate client/src/styles/fonts.css too — the
# ranges there are copied verbatim from each package's wght.css.
set -euo pipefail
cd "$(dirname "$0")/.."

FAMILIES=(inter manrope jetbrains-mono roboto-mono)
SUBSETS=(latin latin-ext cyrillic)

mkdir -p client/public/fonts
for fam in "${FAMILIES[@]}"; do
  for sub in "${SUBSETS[@]}"; do
    src="node_modules/@fontsource-variable/$fam/files/$fam-$sub-wght-normal.woff2"
    if [ -f "$src" ]; then
      cp "$src" client/public/fonts/
    else
      echo "missing: $src" >&2
      exit 1
    fi
  done
done

echo "vendored $(ls client/public/fonts/*.woff2 | wc -l | tr -d ' ') files, $(du -sh client/public/fonts | cut -f1) total"
