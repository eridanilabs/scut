# Replicant tokens API examples

Bearer tokens authenticate a replicant (the agent itself) when it calls SCUT
back from a harness. The raw token is returned **once** from the issue
endpoint; only its sha256 hash is persisted.

Token format: `scut_rk_` + 32 url-safe base64 chars (total 40 chars).

## Issue a token

```bash
curl -sS -X POST \
  -H 'content-type: application/json' \
  -d '{"name":"claude-cli prod","expiresAt":null}' \
  http://localhost:8080/api/v1/replicants/REPLICANT_ID/tokens
```

Example response (`201 Created`):

```json
{
  "id": "tok_V1StGXR8_Z5jdHi6B",
  "name": "claude-cli prod",
  "token": "scut_rk_abcdefghijklmnopqrstuvwxyz012345",
  "expiresAt": null,
  "createdAt": "2025-01-01 00:00:00"
}
```

Save `token` immediately — it is never returned again.

## List tokens for a replicant

```bash
curl -sS http://localhost:8080/api/v1/replicants/REPLICANT_ID/tokens
```

The `token_hash` column is never returned over the wire.

## Revoke a token

```bash
curl -sS -X DELETE \
  http://localhost:8080/api/v1/replicants/tokens/TOKEN_ID
```

Returns `204 No Content` on success, `404 Not Found` if the token id is
unknown.

## Using a token

Once issued, the replicant presents the raw token via the standard HTTP
`Authorization` header on any route protected by `requireReplicantAuth`:

```bash
curl -sS \
  -H 'authorization: Bearer scut_rk_abcdefghijklmnopqrstuvwxyz012345' \
  http://localhost:8080/api/v1/some-protected-route
```
