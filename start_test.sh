#!/bin/bash
set -euo pipefail

step() {
  echo
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶ $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

step "1/6  ESLint"
npm run lint

step "2/6  Prettier (check only — does not rewrite files)"
npm run format:check

step "3/6  TypeScript (src + tests, no emit)"
npm run typecheck

step "4/6  Production build (tsup — browser + node/webhooks dual entries)"
npm run build

step "5/6  Unit tests (node --test via tsx)"
npm run test

step "6/6  Browser-bundle gate (no node builtins in browser entry)"
npm run verify:bundle

echo
echo "✅ All checks passed."
