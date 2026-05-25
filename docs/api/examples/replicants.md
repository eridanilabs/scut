# Replicants API examples

The `/api/v1/replicants` endpoints expose CRUD over the `replicants` table
(registered Replicant connectors / agent harness instances).

## List replicants

```bash
curl -sS http://localhost:8080/api/v1/replicants
```

Example response:

```json
[
  {
    "id": "V1StGXR8_Z5jdHi6B-myT",
    "name": "copilot-bridge-local",
    "harness": "copilot-bridge",
    "config": "{}",
    "status": "unknown",
    "url": null,
    "auto_approve": 0,
    "metadata": "{}",
    "created_at": "2025-01-01 00:00:00",
    "updated_at": "2025-01-01 00:00:00"
  }
]
```
