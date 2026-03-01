#!/usr/bin/env python3
"""Deterministic Chekist Aggregator Spec v1.

Source of truth: ~/.openclaw/workspace/data/incidents.jsonl

Spec v1:
- Window: [start, end] inclusive.
- Filter: ONLY records with severity == "critical".
- Malformed JSON lines: count separately (malformed_json_count), exclude from aggregates.
- Dedup key:
  - if jobId exists: ts + jobId + type + source
  - else: ts + type + source + message_hash(msg)
- Scope mapping (deterministic):
  - chekist: type == chekist_lobster_real_detected_critical OR jobId in CHEKIST_JOB_IDS OR source in {chekist-lobster,lobster-chekist}
  - mekhanik: type == mekhanik_lobster_real_detected_critical OR jobId in MEKHANIK_JOB_IDS OR source in {mekhanik-lobster,lobster-mekhanik}
  - legacy: jobId in LEGACY_JOB_IDS
  - other: typ/source present but not mapped above
  - unknown: only if mapping truly impossible (no typ, no source, no jobId)

Aggregates in report:
- critical_total, by_type, by_scope
- malformed_json_count
- dedup_applied_count
- safety counts:
  - transport_failed: count(type == message_transport_failed)
  - rollback: count(type contains "rollback")

Invariants (hard):
- critical_total == sum(by_type.values())
- critical_total == sum(by_scope.values())
If violated => aggregation_status=INVALID_AGGREGATION

Output JSON to stdout.

Usage:
  python3 chekist_aggregator_v1.py --hours 4
  python3 chekist_aggregator_v1.py --start <isoZ> --end <isoZ>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timedelta, timezone

INCIDENTS = os.path.expanduser("~/.openclaw/workspace/data/incidents.jsonl")

CHEKIST_JOB_IDS = {
    "b72fece5-c8f7-4b9b-842a-208b7efcecc2",
    "89db97f7-e05e-4e3b-990b-fefc1815e7d7",
}
MEKHANIK_JOB_IDS = {
    "bef4ddfa-1fd8-4c64-9495-79d851f4f5f0",
    "0ece27a3-dfc0-47a4-bd3c-6fb6c8c9d403",
}

# Known legacy (non-lobster) jobs can be extended later; keep small and deterministic.
LEGACY_JOB_IDS = {
    # digests / opinions
    "1c292387-c997-46f1-b8a1-e5fd40059713",
    "a0ed4696-8c15-4ab2-b21d-e3e2e9a0b6b6",
    "c1c58593-accd-4cf7-a175-3603514b0275",
    "1ebe95ac-91c9-45e5-a758-a1ff5be367e4",
    # older main monitor jobs
    "305e53a4-049c-4d2e-b248-0cdbea259d3f",
}


def parse_iso(ts: str) -> datetime:
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    return datetime.fromisoformat(ts)


def iso_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def msg_hash(msg: str) -> str:
    return hashlib.sha256(msg.encode("utf-8", errors="ignore")).hexdigest()[:16]


def scope_map(rec: dict) -> str:
    typ = str(rec.get("type") or "")
    src = str(rec.get("source") or "")
    job_id = rec.get("jobId")

    if (
        typ == "chekist_lobster_real_detected_critical"
        or src in {"chekist-lobster", "lobster-chekist"}
        or (isinstance(job_id, str) and job_id in CHEKIST_JOB_IDS)
    ):
        return "chekist"

    if (
        typ == "mekhanik_lobster_real_detected_critical"
        or src in {"mekhanik-lobster", "lobster-mekhanik"}
        or (isinstance(job_id, str) and job_id in MEKHANIK_JOB_IDS)
    ):
        return "mekhanik"

    if isinstance(job_id, str) and job_id in LEGACY_JOB_IDS:
        return "legacy"

    # If we have at least a source/type, we can classify as other
    if typ or src:
        return "other"

    return "unknown"


def dedup_key(rec: dict) -> str:
    ts = str(rec.get("ts") or "")
    typ = str(rec.get("type") or "")
    src = str(rec.get("source") or "")
    job_id = rec.get("jobId")

    if isinstance(job_id, str) and job_id:
        return f"{ts}|{job_id}|{typ}|{src}"

    mh = msg_hash(str(rec.get("msg") or ""))
    return f"{ts}|{typ}|{src}|{mh}"


def aggregate(start: datetime, end: datetime) -> dict:
    malformed = 0
    raw = 0

    seen = set()
    deduped: list[dict] = []

    with open(INCIDENTS, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except Exception:
                malformed += 1
                continue

            if rec.get("severity") != "critical":
                continue

            ts = rec.get("ts")
            if not isinstance(ts, str):
                continue

            try:
                t = parse_iso(ts)
            except Exception:
                continue

            if t < start or t > end:
                continue

            raw += 1
            k = dedup_key(rec)
            if k in seen:
                continue
            seen.add(k)
            rec["_scope"] = scope_map(rec)
            deduped.append(rec)

    by_type: dict[str, int] = {}
    by_scope: dict[str, int] = {}
    unknown_count = 0

    transport_failed = 0
    rollback = 0
    critical_without_notification = 0
    protocol_violation = 0

    for r in deduped:
        typ = str(r.get("type") or "unknown_type")
        by_type[typ] = by_type.get(typ, 0) + 1

        sc = str(r.get("_scope") or "unknown")
        by_scope[sc] = by_scope.get(sc, 0) + 1
        if sc == "unknown":
            unknown_count += 1

        if typ == "message_transport_failed":
            transport_failed += 1
        if typ == "critical_without_notification":
            critical_without_notification += 1
        if typ == "chekist_protocol_violation":
            protocol_violation += 1
        if "rollback" in typ:
            rollback += 1

    critical_total = len(deduped)

    inv_type = critical_total == sum(by_type.values())
    inv_scope = critical_total == sum(by_scope.values())

    aggregation_status = "VALID_AGGREGATION" if (inv_type and inv_scope) else "INVALID_AGGREGATION"

    return {
        "spec": "Aggregator Spec v1",
        "window": {"start": iso_z(start), "end": iso_z(end)},
        "filter": {"severity": "critical"},
        "malformed_json_count": malformed,
        "raw_critical_count": raw,
        "dedup_applied_count": raw - critical_total,
        "critical": {
            "total": critical_total,
            "by_type": dict(sorted(by_type.items(), key=lambda x: x[1], reverse=True)),
            "by_scope": dict(sorted(by_scope.items(), key=lambda x: x[1], reverse=True)),
            "unknown_scope_count": unknown_count,
        },
        "safety": {
            "transport_failed": transport_failed,
            "critical_without_notification": critical_without_notification,
            "chekist_protocol_violation": protocol_violation,
            "rollback": rollback,
        },
        "invariants": {
            "total_equals_sum_by_type": inv_type,
            "total_equals_sum_by_scope": inv_scope,
        },
        "aggregation_status": aggregation_status,
        "sample": [
            {k: r.get(k) for k in ["ts", "type", "source", "jobId", "job", "severity", "msg", "_scope"]}
            for r in deduped[-15:]
        ],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=int, default=None)
    ap.add_argument("--start", type=str, default=None)
    ap.add_argument("--end", type=str, default=None)
    args = ap.parse_args()

    now = datetime.now(timezone.utc)

    if args.hours is not None:
        start = now - timedelta(hours=args.hours)
        end = now
    else:
        if not args.start or not args.end:
            raise SystemExit("Provide --hours or both --start and --end")
        start = parse_iso(args.start)
        end = parse_iso(args.end)

    out = aggregate(start=start, end=end)
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
