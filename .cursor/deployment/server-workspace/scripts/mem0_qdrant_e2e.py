#!/usr/bin/env python3
"""E2E check for the Mem0 Qdrant-backed store.

Flow (minimal but end-to-end for vector store):
1) "embed" (deterministic pseudo-embedding; dimension must match collection)
2) upsert a test point with a unique test_id
3) search using the same vector + filter by test_id
4) delete the test point

This does NOT validate Mem0's full application-layer semantics.
It is intended to catch regressions like /points/search 400, schema mismatch, collection errors, etc.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
import uuid
import urllib.request
import urllib.error

QDRANT = os.environ.get("QDRANT_URL", "http://localhost:6333")
COLLECTION = os.environ.get("QDRANT_COLLECTION", "openclaw-mem0")
VECTOR_SIZE = int(os.environ.get("QDRANT_VECTOR_SIZE", "1536"))
TIMEOUT_S = float(os.environ.get("QDRANT_TIMEOUT_S", "5"))


def _req(method: str, path: str, body: dict | None = None) -> dict:
    url = QDRANT.rstrip("/") + path
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        # Re-raise with body for debugging.
        raise SystemExit(f"http {e.code} {method} {path}: {raw[:1200]}")


def pseudo_embed(text: str, size: int) -> list[float]:
    # Deterministic pseudo-embedding: hash stream -> floats in [-1, 1].
    # Goal: stable vector of correct dimensionality without external embedder.
    out: list[float] = []
    i = 0
    while len(out) < size:
        h = hashlib.sha256(f"{text}:{i}".encode()).digest()
        for b in h:
            # map 0..255 -> -1..1
            out.append((b / 255.0) * 2.0 - 1.0)
            if len(out) >= size:
                break
        i += 1
    return out


def main() -> None:
    ts_ms = int(time.time() * 1000)
    point_id = str(uuid.uuid4())
    test_id = f"mem0_e2e_{ts_ms}"  # stored in payload for filtering
    vector = pseudo_embed(test_id, VECTOR_SIZE)

    # Upsert
    upsert = {
        "points": [
            {
                "id": point_id,
                "vector": vector,
                "payload": {
                    "_e2e": True,
                    "_e2e_kind": "mem0_qdrant",
                    "test_id": test_id,
                    "ts_ms": ts_ms,
                },
            }
        ]
    }
    upsert_res = _req("PUT", f"/collections/{COLLECTION}/points?wait=true", upsert)
    if upsert_res.get("status") != "ok":
        raise SystemExit(f"upsert failed: {upsert_res}")

    # Search
    search = {
        "vector": vector,
        "limit": 3,
        "with_payload": True,
        "filter": {"must": [{"key": "test_id", "match": {"value": test_id}}]},
    }
    search_res = _req("POST", f"/collections/{COLLECTION}/points/search", search)
    if search_res.get("status") != "ok":
        raise SystemExit(f"search failed: {search_res}")

    hits = search_res.get("result") or []
    if not hits:
        raise SystemExit(f"search returned 0 hits for test_id={test_id}")

    # Cleanup
    delete = {"points": [point_id]}
    del_res = _req("POST", f"/collections/{COLLECTION}/points/delete?wait=true", delete)
    if del_res.get("status") != "ok":
        raise SystemExit(f"delete failed: {del_res}")

    print(json.dumps({"ok": True, "test_id": test_id, "point_id": point_id, "hits": len(hits)}))


if __name__ == "__main__":
    main()
