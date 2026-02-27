#!/usr/bin/env python3
"""Lobster Mekhanik runner (REAL mode, controlled).

Constraints for controlled cutover:
- safe-auto: DISABLED (no automated restarts/cron fixes)
- risky actions: approval-only (not executed here)
- no message() calls (Chekist will alert on incidents)

Behavior:
- Read last 4h of incidents.jsonl (tail-limited) and detect active critical incidents.
- If none: write a heartbeat record only.
- If any active critical: append ONE lobster-scoped critical incident marker so the cutover verifier can trip stop-loss.
- Always append metrics to mekhanik-lobster-metrics.jsonl with mode="real".

Files:
- incidents: ~/.openclaw/workspace/data/incidents.jsonl
- metrics:  ~/.openclaw/.runtime/mekhanik-lobster-metrics.jsonl
- heartbeat: ~/.openclaw/runtime/monitor-heartbeat.jsonl
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone

INCIDENTS = os.path.expanduser("~/.openclaw/workspace/data/incidents.jsonl")
OUT_METRICS = os.path.expanduser("~/.openclaw/.runtime/mekhanik-lobster-metrics.jsonl")
HEARTBEAT = os.path.expanduser("~/.openclaw/runtime/monitor-heartbeat.jsonl")

# Match legacy skill semantics
SAFE_AUTO_TYPES = {"gateway_down", "announce_queue_loop", "gateway_memory_high"}
RISKY_TYPES = {"cron_error", "cron_skip", "snapshot_stale"}

SOURCE = "mekhanik-lobster"


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_ts(ts: str) -> float:
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    return datetime.fromisoformat(ts).timestamp()


def read_recent_incidents(path: str, window_h: int = 4, tail_n: int = 6000) -> list[dict]:
    if not os.path.exists(path):
        return []

    # tail-limited read
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            # crude tail: read last ~2MB max
            read_size = min(size, 2_000_000)
            f.seek(size - read_size)
            chunk = f.read().decode("utf-8", errors="ignore")
        lines = [ln for ln in chunk.splitlines() if ln.strip()][-tail_n:]
    except Exception:
        # fallback full read (best-effort)
        with open(path, "r", encoding="utf-8") as f:
            lines = [ln.strip() for ln in f if ln.strip()][-tail_n:]

    now = time.time()
    since = now - window_h * 3600

    out: list[dict] = []
    for line in lines:
        try:
            r = json.loads(line)
        except Exception:
            continue
        ts = r.get("ts")
        if not isinstance(ts, str):
            continue
        try:
            if parse_ts(ts) >= since:
                out.append(r)
        except Exception:
            continue
    return out


def active_critical(events: list[dict]) -> list[dict]:
    # resolved filtering (simplified): collect resolved ref_ids
    resolved = {e.get("ref_id") for e in events if e.get("type") == "resolved" and isinstance(e.get("ref_id"), str)}

    out = []
    for e in events:
        if e.get("type") == "resolved":
            continue
        if e.get("severity") != "critical":
            continue
        if e.get("resolved") is True:
            continue
        if isinstance(e.get("id"), str) and e["id"] in resolved:
            continue
        out.append(e)
    return out


def append_jsonl(path: str, rec: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def main() -> None:
    events = read_recent_incidents(INCIDENTS, window_h=4, tail_n=6000)
    crit = active_critical(events)

    planned_safe_auto = 0
    planned_risky = 0
    for e in crit:
        t = e.get("type")
        if t in SAFE_AUTO_TYPES:
            planned_safe_auto += 1
        elif t in RISKY_TYPES:
            planned_risky += 1
        else:
            planned_risky += 1

    # REAL mode: no actions performed.
    # If any critical is present, write a single marker incident (lobster-scoped) to trip stop-loss.
    if crit:
        marker = {
            "ts": iso_now(),
            "type": "mekhanik_lobster_real_detected_critical",
            "source": SOURCE,
            "severity": "critical",
            "msg": f"Detected {len(crit)} active critical incidents in last 4h (safe_auto disabled; no actions executed).",
            "detail": {
                "sample": [
                    {
                        "type": c.get("type"),
                        "source": c.get("source"),
                        "jobId": c.get("jobId"),
                        "id": c.get("id"),
                    }
                    for c in crit[:5]
                ]
            },
            "resolved": False,
        }
        append_jsonl(INCIDENTS, marker)
    else:
        hb = {"ts": iso_now(), "type": "heartbeat", "source": SOURCE, "status": "ok", "window": "4h-empty"}
        append_jsonl(HEARTBEAT, hb)

    metrics = {
        "ts": iso_now(),
        "mode": "real",
        "runs_total": 1,
        "planned_safe_auto": planned_safe_auto,
        "planned_risky": planned_risky,
        "state_write_failed": 0,
        "restart_loop_blocked": 0,
        "circuit_breaker_triggered": 0,
        "message_events_total": 0,
        "message_events_by_type": {"alert": 0, "escalation": 0, "other": 0},
        "message_events_suppressed": 0,
    }
    append_jsonl(OUT_METRICS, metrics)

    print(json.dumps({"ok": True, **metrics}, ensure_ascii=False))


if __name__ == "__main__":
    main()
