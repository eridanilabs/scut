#!/usr/bin/env bash
# scripts/acp-demo.sh - end-to-end smoke for the ACP TCP transport.
#
# This is the developer-side demo for bill-znj. CI does NOT run it.
# It requires a working `copilot` CLI on PATH (override with
# SCUT_ACP_COPILOT_PATH=...) and exits non-zero on the first failure.
#
# Per spec sec 12.1 we pre-allocate a TCP port and pass it explicitly
# to `copilot --acp --port <PORT>`, then dial 127.0.0.1:<PORT> from
# SCUT. The live Copilot CLI does NOT announce its port on stdout
# and rejects `--bind`, so this static-port + `mode: 'dial'` pattern
# is the supported configuration.
#
# Pipeline:
#   1. Build the server.
#   2. Seed an `acp`-harness replicant whose config dials 127.0.0.1:$PORT.
#   3. Start `copilot --acp --port $PORT` in the background.
#   4. Start the SCUT server in the background.
#   5. Issue a replicant bearer token via
#      POST /api/v1/replicants/:id/tokens (capture `.token`).
#   6. Create a thread and grant the replicant read access to it
#      (thread_permissions is admin-only; seeded via tsx snippet).
#   7. POST /api/v1/threads/:id/dispatches { input: 'say PONG' }.
#   8. Poll GET /api/v1/traces/:dispatchId with the bearer token until
#      .status == "succeeded" (or terminal failure / 60s timeout).
#   9. Assert GET /api/v1/traces/:dispatchId/events with the bearer
#      token contains at least one event of kind=agent_message_chunk.
#  10. Tear everything down.
set -euo pipefail

if ! command -v "${SCUT_ACP_COPILOT_PATH:-copilot}" >/dev/null 2>&1; then
  echo "acp-demo: requires the copilot CLI on PATH (set SCUT_ACP_COPILOT_PATH to override)" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Project-local scratch dir. Recreated fresh per run. /tmp is forbidden
# by repository convention; this path is gitignored.
WORK="$ROOT/.scut-acp-demo-work"
rm -rf "$WORK"
mkdir -p "$WORK"

PORT="$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(('127.0.0.1', 0))
print(s.getsockname()[1])
s.close()
PY
)"
export SCUT_DB_PATH="$WORK/scut.db"
export SCUT_CALLBACK_SECRET="demo"
export SCUT_ACP_INTEGRATION="1"

ACP_PID=
SCUT_PID=
cleanup() {
  set +e
  [[ -n "$ACP_PID" ]] && kill "$ACP_PID" 2>/dev/null
  [[ -n "$SCUT_PID" ]] && kill "$SCUT_PID" 2>/dev/null
}
trap cleanup EXIT

echo "== build =="
npm run build -w @scut/server

echo "== seed replicant =="
# seed-replicant.ts does not accept CLI flags for this case; use a
# small inline tsx snippet that calls the existing DB modules
# directly. config.tcp.mode='dial' tells AcpConnector to dial our
# pre-spawned copilot process at the pre-allocated loopback port.
REPLICANT_NAME="acp-demo"
SEED_CONFIG_JSON="$(jq -n --arg port "$PORT" \
  '{transport:"tcp",tcp:{mode:"dial",host:"127.0.0.1",port:($port|tonumber)}}')"
REPLICANT_ID="$(SCUT_DB_PATH="$SCUT_DB_PATH" \
  SEED_NAME="$REPLICANT_NAME" \
  SEED_CONFIG="$SEED_CONFIG_JSON" \
  node --import tsx --input-type=module -e '
    import db from "./packages/server/src/db/db.ts";
    import { getReplicantByName, createReplicant, updateReplicant }
      from "./packages/server/src/db/ReplicantRepo.ts";
    const name = process.env.SEED_NAME;
    const config = JSON.parse(process.env.SEED_CONFIG);
    const existing = getReplicantByName(name);
    let id;
    if (existing) {
      updateReplicant(existing.id, { harness: "acp", status: "online", config });
      id = existing.id;
    } else {
      id = createReplicant({ name, harness: "acp", status: "online", config }).id;
    }
    process.stdout.write(id);
  ')"
echo "replicantId=$REPLICANT_ID"

echo "== start copilot --acp --port $PORT =="
"${SCUT_ACP_COPILOT_PATH:-copilot}" --acp --port "$PORT" \
  >"$WORK/copilot.out" 2>"$WORK/copilot.err" &
ACP_PID=$!
sleep 1

echo "== start scut server =="
( npm run dev -w @scut/server >"$WORK/scut.out" 2>"$WORK/scut.err" ) &
SCUT_PID=$!
sleep 2

echo "== issue replicant bearer token =="
# Admin endpoint: POST /replicants/:id/tokens returns a one-shot raw token
# in `.token` (only time the raw value is exposed). Subsequent /traces
# reads use it as `Authorization: Bearer ...`.
REPLICANT_TOKEN="$(curl -fsS -X POST \
  "http://localhost:3000/api/v1/replicants/$REPLICANT_ID/tokens" \
  -H 'content-type: application/json' \
  -d '{"name":"acp-demo"}' | jq -r .token)"
if [[ -z "$REPLICANT_TOKEN" || "$REPLICANT_TOKEN" == "null" ]]; then
  echo "FAIL: could not issue replicant token" >&2
  exit 1
fi

echo "== create thread =="
THREAD_ID="$(curl -fsS -X POST http://localhost:3000/api/v1/threads \
  -H 'content-type: application/json' \
  -d '{"title":"acp demo"}' | jq -r .id)"
echo "threadId=$THREAD_ID"

echo "== grant thread read permission to replicant =="
# thread_permissions has no HTTP surface (it is an internal authz table
# used by /traces). Insert the row inline via tsx so the replicant can
# read its own dispatch via the API in the polling/assert steps below.
SCUT_DB_PATH="$SCUT_DB_PATH" \
SEED_THREAD_ID="$THREAD_ID" \
SEED_REPLICANT_ID="$REPLICANT_ID" \
node --import tsx --input-type=module -e '
  import { upsertThreadPermission }
    from "./packages/server/src/db/CommentDispatchRepo.ts";
  upsertThreadPermission(
    process.env.SEED_THREAD_ID,
    process.env.SEED_REPLICANT_ID,
    true
  );
'

echo "== POST dispatch =="
DISPATCH_ID="$(curl -fsS -X POST "http://localhost:3000/api/v1/threads/$THREAD_ID/dispatches" \
  -H 'content-type: application/json' \
  -d "{\"replicantId\":\"$REPLICANT_ID\",\"input\":\"say PONG\"}" | jq -r .id)"
echo "dispatchId=$DISPATCH_ID"

echo "== poll GET /api/v1/traces/:id =="
STATUS=""
for i in $(seq 1 60); do
  TRACE_JSON="$(curl -fsS \
    -H "Authorization: Bearer $REPLICANT_TOKEN" \
    "http://localhost:3000/api/v1/traces/$DISPATCH_ID")"
  STATUS="$(echo "$TRACE_JSON" | jq -r .status)"
  echo "  poll $i: status=$STATUS"
  if [[ "$STATUS" == "succeeded" ]]; then break; fi
  if [[ "$STATUS" == "failed" || "$STATUS" == "cancelled" ]]; then
    echo "FAIL: dispatch terminated as $STATUS" >&2
    echo "$TRACE_JSON" | jq -r '.error // empty' >&2
    exit 1
  fi
  sleep 1
done

if [[ "$STATUS" != "succeeded" ]]; then
  echo "FAIL: dispatch did not succeed within 60s" >&2
  exit 1
fi

echo "== assert GET /api/v1/traces/:id/events =="
EVENTS_JSON="$(curl -fsS \
  -H "Authorization: Bearer $REPLICANT_TOKEN" \
  "http://localhost:3000/api/v1/traces/$DISPATCH_ID/events")"
COUNT="$(echo "$EVENTS_JSON" \
  | jq '.events | map(select(.kind == "agent_message_chunk")) | length')"
if [[ -z "$COUNT" || "$COUNT" == "null" || "$COUNT" -lt 1 ]]; then
  echo "FAIL: expected at least one agent_message_chunk event, got ${COUNT:-0}" >&2
  exit 1
fi

echo "== OK =="
