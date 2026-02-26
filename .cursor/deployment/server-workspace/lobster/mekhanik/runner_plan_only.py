#!/usr/bin/env python3
"""Lobster Mekhanik runner (plan-only).

- Collects unresolved critical incidents (last 6h) from incidents.jsonl
- Uses persistent runtime state (restart-guard/circuit-breaker) but DOES NOT execute actions
- Produces plan counts: planned_safe_auto, planned_risky
- Records metrics JSONL per run.

This is designed for controlled cutover phase.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone

from runtime_state import load_state, save_state, cleanup_stale

INCIDENTS = os.path.expanduser("~/.openclaw/workspace/data/incidents.jsonl")
OUT_METRICS = os.path.expanduser("~/.openclaw/.runtime/mekhanik-lobster-metrics.jsonl")

SAFE_AUTO_TYPES = {"gateway_down", "announce_queue_loop", "gateway_memory_high"}
RISKY_TYPES = {"cron_error", "cron_skip", "snapshot_stale"}


def parse_ts(ts: str) -> float:
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    return datetime.fromisoformat(ts).timestamp()


def read_jsonl(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    out = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except Exception:
                # ignore malformed
                continue
    return out


def main() -> None:
    now = time.time()
    since = now - 6 * 3600

    events = read_jsonl(INCIDENTS)
    recent = []
    for e in events:
        ts = e.get("ts")
        if not isinstance(ts, str):
            continue
        try:
            if parse_ts(ts) >= since:
                recent.append(e)
        except Exception:
            continue

    # resolved filtering (simplified): collect resolved ref_ids
    resolved = {e.get("ref_id") for e in recent if e.get("type") == "resolved" and isinstance(e.get("ref_id"), str)}

    active_critical = []
    for e in recent:
        if e.get("type") == "resolved":
            continue
        if e.get("severity") != "critical":
            continue
        if e.get("resolved") is True:
            continue
        if isinstance(e.get("id"), str) and e["id"] in resolved:
            continue
        active_critical.append(e)

    planned_safe_auto = 0
    planned_risky = 0

    for e in active_critical:
        t = e.get("type")
        if t in SAFE_AUTO_TYPES:
            planned_safe_auto += 1
        elif t in RISKY_TYPES:
            planned_risky += 1
        else:
            planned_risky += 1  # treat unknown as risky

    # persistent state write
    state_write_failed = 0
    try:
        st = load_state()
        cleanup_stale(st, now)
        save_state(st)
    except Exception:
        state_write_failed = 1

    # message event accounting (plan-only): count planned messages and mark them suppressed.
    message_events_by_type = {"alert": 0, "escalation": 0, "other": 0}
    message_events_suppressed = 0

    # Heuristic: any active critical incident implies we'd alert/escalate in real mode.
    if active_critical:
        message_events_by_type["alert"] += 1
        message_events_suppressed += 1  # plan_only suppresses sending

    # Test hook (no state mutation): force a planned message
    if os.environ.get("MEKHANIK_TEST_PLANNED_MESSAGE") == "1":
        message_events_by_type["other"] += 1
        message_events_suppressed += 1

    message_events_total = sum(message_events_by_type.values())

    rec = {
        "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "runs_total": 1,
        "planned_safe_auto": planned_safe_auto,
        "planned_risky": planned_risky,
        "state_write_failed": state_write_failed,
        "restart_loop_blocked": 0,
        "circuit_breaker_triggered": 0,
        "message_events_total": message_events_total,
        "message_events_by_type": message_events_by_type,
        "message_events_suppressed": message_events_suppressed,
    }

    os.makedirs(os.path.dirname(OUT_METRICS), exist_ok=True)
    with open(OUT_METRICS, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    print(json.dumps({"ok": True, **rec}, ensure_ascii=False))


if __name__ == "__main__":
    main()
