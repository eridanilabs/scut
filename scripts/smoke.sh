#!/usr/bin/env bash
# scripts/smoke.sh - end-to-end curl smoke tests for SCUT.
# Each port unit / endpoint adds one or more checks below.
# Run against a fresh scut-server instance: npm run dev in another terminal.
set -euo pipefail

BASE="${SCUT_BASE_URL:-http://localhost:8080}"
FAIL=0

check() {
  local name="$1"; shift
  local expected_status="$1"; shift
  local actual
  actual="$(curl -sS -o /dev/null -w '%{http_code}' "$@" || true)"
  if [[ "$actual" == "$expected_status" ]]; then
    echo "ok    $name -> $actual"
  else
    echo "FAIL  $name -> $actual (expected $expected_status)"
    FAIL=$((FAIL+1))
  fi
}

echo "== SCUT smoke against $BASE =="

# Health
check "GET /healthz"           200 "$BASE/healthz"
check "GET /readyz"            200 "$BASE/readyz"

# Meta API (unversioned, allowed)
check "GET /api/docs"          200 "$BASE/api/docs"
check "GET /api/health"        200 "$BASE/api/health"

# SPA fallback (any non-/api/, non-/healthz route returns index.html 200)
check "GET / (SPA fallback)"   200 "$BASE/"
check "GET /any/route"         200 "$BASE/any/route"

# v1 API surface - subsequent tasks add real endpoint checks here.
# Example placeholder once /api/v1/boards exists:
# check "GET /api/v1/boards"   200 "$BASE/api/v1/boards"
check "GET /api/v1/replicants" 200 "$BASE/api/v1/replicants"
check "GET /api/v1/replicants/:bogus/tokens (404)" 404 "$BASE/api/v1/replicants/__nope__/tokens"

echo "== summary =="
if [[ "$FAIL" -gt 0 ]]; then
  echo "FAILED: $FAIL check(s)"
  exit 1
fi
echo "all ok"
