#!/usr/bin/env python3
"""Deterministic gate calculator for Lobster «Участковый».

Goals:
- Single source of truth for lobster-scoped gate deltas.
- Deterministic (no network, no OpenClaw tools).
- Prod-safe (read-only by default).

Rules (Spec):
- allowlist sources: {"uchastkovy-lobster", "lobster-uchastkovy"}
- Δcritical: severity=="critical" AND type != "cron_error"
- Δtransport: type=="message_transport_failed"
- Δrollback: "rollback" substring in type
- PASS only if Δcritical==0 AND Δtransport==0 AND Δrollback==0

Output:
- JSON to stdout (stable keys).

Exit codes:
- 0: PASS
- 2: FAIL
- 3: input error (baseline/incidents parse)
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from typing import Any, Dict, Iterable, Tuple

ALLOWLIST_SOURCES = {"uchastkovy-lobster", "lobster-uchastkovy"}


def _parse_iso_z(s: str) -> dt.datetime:
    # Accept ISO8601 with Z.
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


def _iter_jsonl(path: str) -> Iterable[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except Exception:
                # ignore malformed lines (counted separately)
                yield {"__malformed__": True, "raw": line[:400]}


def compute_deltas(*,
                   incidents_path: str,
                   start_ts: str,
                   allow_sources: set[str] = ALLOWLIST_SOURCES,
                   inject_critical: int = 0,
                   inject_transport: int = 0,
                   inject_rollback: int = 0) -> Tuple[Dict[str, int], Dict[str, Any]]:
    start_dt = _parse_iso_z(start_ts)

    malformed = 0
    delta_critical = 0
    delta_transport = 0
    delta_rollback = 0

    for rec in _iter_jsonl(incidents_path):
        if rec.get("__malformed__"):
            malformed += 1
            continue

        ts = rec.get("ts")
        if not ts:
            continue
        try:
            t = _parse_iso_z(ts)
        except Exception:
            continue
        if t < start_dt:
            continue

        src = rec.get("source")
        if src not in allow_sources:
            continue

        typ = str(rec.get("type") or "")
        sev = rec.get("severity")

        if sev == "critical" and typ != "cron_error":
            delta_critical += 1

        if typ == "message_transport_failed":
            delta_transport += 1

        if "rollback" in typ:
            delta_rollback += 1

    # Negative-test hooks (do not depend on incidents)
    delta_critical += max(0, inject_critical)
    delta_transport += max(0, inject_transport)
    delta_rollback += max(0, inject_rollback)

    deltas = {
        "delta_critical": delta_critical,
        "delta_transport": delta_transport,
        "delta_rollback": delta_rollback,
    }
    meta = {
        "malformed_lines_total": malformed,
    }
    return deltas, meta


def decide(deltas: Dict[str, int]) -> Tuple[str, list[str]]:
    reasons: list[str] = []
    if deltas["delta_critical"] != 0:
        reasons.append(f"Δcritical={deltas['delta_critical']} (lobster-scoped, excl cron_error)")
    if deltas["delta_transport"] != 0:
        reasons.append(f"Δtransport={deltas['delta_transport']}")
    if deltas["delta_rollback"] != 0:
        reasons.append(f"Δrollback={deltas['delta_rollback']}")

    status = "PASS" if not reasons else "FAIL"
    return status, reasons


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline-path", required=True)
    ap.add_argument("--incidents-path", default=os.path.expanduser("~/.openclaw/workspace/data/incidents.jsonl"))
    ap.add_argument("--start-ts", default=None, help="Override startTs (otherwise taken from baseline JSON)")
    ap.add_argument("--incidents-source", default="incidents.jsonl")

    # test hooks
    ap.add_argument("--inject-critical", type=int, default=0)
    ap.add_argument("--inject-transport", type=int, default=0)
    ap.add_argument("--inject-rollback", type=int, default=0)

    args = ap.parse_args()

    try:
        baseline = json.load(open(args.baseline_path, "r", encoding="utf-8"))
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"baseline_read_failed: {e}"}, ensure_ascii=False))
        return 3

    baseline_start = baseline.get("startTs")
    if not isinstance(baseline_start, str) or not baseline_start:
        print(json.dumps({"ok": False, "error": "baseline_missing_startTs"}, ensure_ascii=False))
        return 3

    start_ts = args.start_ts or baseline_start

    try:
        deltas, meta = compute_deltas(
            incidents_path=args.incidents_path,
            start_ts=start_ts,
            inject_critical=args.inject_critical,
            inject_transport=args.inject_transport,
            inject_rollback=args.inject_rollback,
        )
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"compute_failed: {e}"}, ensure_ascii=False))
        return 3

    status, reasons = decide(deltas)

    out: Dict[str, Any] = {
        "ok": True,
        "module": "uchastkovy_gate_calc",
        "baselinePath": args.baseline_path,
        "baselineStartTs": baseline_start,
        "startTs": start_ts,
        "incidentsPath": args.incidents_path,
        "incidentsSource": args.incidents_source,
        "allowlistSources": sorted(ALLOWLIST_SOURCES),
        "deltas": deltas,
        "decision": {
            "status": status,
            "reasons": reasons,
            "rule": "PASS iff Δcritical==0 && Δtransport==0 && Δrollback==0 (lobster-scoped; Δcritical excludes cron_error)",
        },
        "meta": meta,
        "ts": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    print(json.dumps(out, ensure_ascii=False, sort_keys=True))

    return 0 if status == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
