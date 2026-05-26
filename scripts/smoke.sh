#!/usr/bin/env bash
# scripts/smoke.sh - end-to-end curl smoke tests for SCUT.
# Each port unit / endpoint adds one or more checks below.
# Run against a fresh scut-server instance: npm run dev in another terminal.
set -euo pipefail

BASE="${SCUT_BASE_URL:-http://localhost:8080}"
FAIL=0

# Mode: "proxy" exercises the Caddy reverse-proxy + UI topology (default for
# the Caddy dev stack on :8080). "server" exercises a bare @scut/server
# process (default for direct dev on :3000) which does not expose the
# proxy-only /healthz, /readyz, /api/docs, /api/health, or SPA fallback.
if [[ -z "${SCUT_SMOKE_MODE:-}" ]]; then
  case "$BASE" in
    *:3000*) SCUT_SMOKE_MODE="server" ;;
    *)       SCUT_SMOKE_MODE="proxy"  ;;
  esac
fi
case "$SCUT_SMOKE_MODE" in
  server|proxy) ;;
  *)
    echo "FAIL  invalid SCUT_SMOKE_MODE=$SCUT_SMOKE_MODE (expected 'server' or 'proxy')"
    exit 2
    ;;
esac

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

echo "== SCUT smoke against $BASE (mode=$SCUT_SMOKE_MODE) =="

if [[ "$SCUT_SMOKE_MODE" == "proxy" ]]; then
  # Health (proxy-only endpoints exposed by Caddy)
  check "GET /healthz"           200 "$BASE/healthz"
  check "GET /readyz"            200 "$BASE/readyz"

  # Meta API (unversioned, allowed)
  check "GET /api/docs"          200 "$BASE/api/docs"
  check "GET /api/health"        200 "$BASE/api/health"

  # SPA fallback (any non-/api/, non-/healthz route returns index.html 200)
  check "GET / (SPA fallback)"   200 "$BASE/"
  check "GET /any/route"         200 "$BASE/any/route"
else
  # Server-only health endpoint (no Caddy, no UI, no SPA fallback).
  check "GET /health"            200 "$BASE/health"
fi

# v1 API surface - subsequent tasks add real endpoint checks here.
# Example placeholder once /api/v1/boards exists:
# check "GET /api/v1/boards"   200 "$BASE/api/v1/boards"
check "GET /api/v1/replicants" 200 "$BASE/api/v1/replicants"
check "GET /api/v1/replicants/:bogus/tokens (404)" 404 "$BASE/api/v1/replicants/__nope__/tokens"

# Traces (Phase 2.5). Requires bearer auth. The dev seed (SCUT_SEED_SMOKE=1)
# creates a deterministic replicant + token + dispatch so these checks pass
# out of the box; in other environments callers can override the defaults.
SCUT_REPLICANT_TOKEN="${SCUT_REPLICANT_TOKEN:-scut_rk_dev_smoke_token}"
SCUT_TRACE_ID="${SCUT_TRACE_ID:-scut_smoke_dispatch_001}"
AUTH_HDR="Authorization: Bearer ${SCUT_REPLICANT_TOKEN}"

check "GET /api/v1/traces (no auth -> 401)"     401 "$BASE/api/v1/traces"
check "GET /api/v1/traces (auth -> 200)"        200 -H "$AUTH_HDR" "$BASE/api/v1/traces"
check "GET /api/v1/traces?status=bogus (400)"   400 -H "$AUTH_HDR" "$BASE/api/v1/traces?status=bogus"
check "GET /api/v1/traces/$SCUT_TRACE_ID (200)" 200 -H "$AUTH_HDR" "$BASE/api/v1/traces/$SCUT_TRACE_ID"
check "GET /api/v1/traces/__nope__ (404)"       404 -H "$AUTH_HDR" "$BASE/api/v1/traces/__nope__"
check "GET /api/v1/traces/$SCUT_TRACE_ID/events (501)" 501 -H "$AUTH_HDR" "$BASE/api/v1/traces/$SCUT_TRACE_ID/events"

echo "== summary =="
if [[ "$FAIL" -gt 0 ]]; then
  echo "FAILED: $FAIL check(s)"
  exit 1
fi
echo "all ok"
