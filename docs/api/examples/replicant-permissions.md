# Replicant Permissions API

Per-tool permission decisions for a replicant. Backed by the
`replicant_permissions` table (see migration `003-replicant-permissions`).

All endpoints below require a replicant bearer token in the `Authorization`
header (see `docs/api/examples/replicant-tokens.md` for token issuance).

Base: `${SCUT_BASE_URL:-http://localhost:8080}`

## List permissions for a replicant

```bash
curl -sS \
  -H "Authorization: Bearer ${SCUT_REPLICANT_TOKEN}" \
  "${SCUT_BASE_URL}/api/v1/replicants/${REPLICANT_ID}/permissions"
```

Returns `200` with an array of `ReplicantPermissionRow` objects, or `404`
`{"error":"replicant not found"}` if the replicant does not exist.

## Upsert a permission (PUT)

Upserts a per-tool decision. `scope=replicant` is a durable decision across
sessions; `scope=session` is scoped to a specific ACP `acpSessionId`.

```bash
# Allow a tool for the whole replicant
curl -sS -X PUT \
  -H "Authorization: Bearer ${SCUT_REPLICANT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
        "tool": "fs/read_text_file",
        "scope": "replicant",
        "decision": "allow"
      }' \
  "${SCUT_BASE_URL}/api/v1/replicants/${REPLICANT_ID}/permissions"

# Allow a tool only for one ACP session
curl -sS -X PUT \
  -H "Authorization: Bearer ${SCUT_REPLICANT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
        "tool": "terminal/execute",
        "scope": "session",
        "decision": "allow",
        "acpSessionId": "acp-session-abc123"
      }' \
  "${SCUT_BASE_URL}/api/v1/replicants/${REPLICANT_ID}/permissions"
```

Tool keys are normalized server-side: lowercased, trimmed, with internal
whitespace runs collapsed to `/`. For example `"Read File"` becomes
`"read/file"`. Existing slash-separated keys and underscores are preserved.

Validation errors:

- `400 {"error":"scope=session requires acpSessionId"}`
- `400 {"error":"scope=replicant must not include acpSessionId"}`
- `404 {"error":"replicant not found"}`

Successful responses return `200` with the upserted row.

## Delete a permission

```bash
curl -sS -X DELETE \
  -H "Authorization: Bearer ${SCUT_REPLICANT_TOKEN}" \
  "${SCUT_BASE_URL}/api/v1/replicants/permissions/${PERMISSION_ID}"
```

Returns `204` on success, or `404 {"error":"not found"}` if no row matched.
