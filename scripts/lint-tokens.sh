#!/usr/bin/env bash
# Fails if any raw Tailwind palette utility (bg-red-500, text-green-600, …)
# appears in authored client code. Everything must go through the semantic
# tokens (primary / success / warning / destructive / info / muted / …).
#
# components/ui/ is exempt: a couple of stock shadcn primitives still carry
# vendor defaults, and they are theme-driven where it matters.
set -euo pipefail
cd "$(dirname "$0")/.."

PATTERN='(text|bg|border|from|to|via|ring|decoration|fill|stroke)-(red|green|blue|yellow|orange|pink|purple|amber|sky|gray|slate|zinc|indigo|teal|cyan|lime|emerald|violet|fuchsia|rose)-[0-9]{2,3}'

hits=$(grep -rnoE "$PATTERN" --include="*.tsx" --include="*.ts" client/src 2>/dev/null \
  | grep -vE 'components/ui/|__tests__' || true)

if [ -n "$hits" ]; then
  echo "✗ Raw palette utilities found — use semantic tokens instead:" >&2
  echo "$hits" >&2
  echo "" >&2
  echo "$(echo "$hits" | wc -l | tr -d ' ') offender(s)." >&2
  exit 1
fi
echo "✓ No raw palette utilities outside components/ui/."
