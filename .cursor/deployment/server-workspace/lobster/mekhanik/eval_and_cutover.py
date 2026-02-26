#!/usr/bin/env python3
"""Evaluate 24h plan-only metrics and propose cutover.

Outputs a JSON decision object to stdout.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone

METRICS = os.path.expanduser("~/.openclaw/.runtime/mekhanik-lobster-metrics.jsonl")


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
                continue
    return out


def parse_ts(ts: str) -> datetime:
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    return datetime.fromisoformat(ts)


def main() -> None:
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)

    rows = [r for r in read_jsonl(METRICS) if isinstance(r.get("ts"), str)]
    rows24 = []
    for r in rows:
        try:
            if parse_ts(r["ts"]) >= since:
                rows24.append(r)
        except Exception:
            continue

    agg = {
        "runs": len(rows24),
        "state_write_failed": sum(int(r.get("state_write_failed", 0) or 0) for r in rows24),
        "restart_loop_blocked": sum(int(r.get("restart_loop_blocked", 0) or 0) for r in rows24),
        "circuit_breaker_triggered": sum(int(r.get("circuit_breaker_triggered", 0) or 0) for r in rows24),
        "planned_safe_auto": sum(int(r.get("planned_safe_auto", 0) or 0) for r in rows24),
        "planned_risky": sum(int(r.get("planned_risky", 0) or 0) for r in rows24),
    }

    # 30m period => expected_runs_24h=48; accept >=46 to tolerate minor scheduling jitter
    ok = (
        agg["runs"] >= 46 and
        agg["state_write_failed"] == 0 and
        agg["restart_loop_blocked"] == 0 and
        agg["circuit_breaker_triggered"] == 0
    )

    decision = {
        "ts": now.isoformat().replace("+00:00", "Z"),
        "ok_to_enable_safe_auto": ok,
        "agg24h": agg,
    }

    print(json.dumps({"ok": True, "decision": decision}, ensure_ascii=False))


if __name__ == "__main__":
    main()
