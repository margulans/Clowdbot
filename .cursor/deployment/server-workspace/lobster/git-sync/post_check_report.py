#!/usr/bin/env python3
"""24h decision-gate reporter for Lobster Git-sync plan-only soak."""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone

METRICS = os.path.expanduser("~/.openclaw/.runtime/git-sync-lobster-metrics.jsonl")


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
    r24 = []
    for r in rows:
        try:
            if parse_ts(r["ts"]) >= since:
                r24.append(r)
        except Exception:
            continue

    agg = {
        "runs": len(r24),
        "lock_acquired": sum(int(r.get("lock_acquired", 0) or 0) for r in r24),
        "stale_lock_recovered": sum(int(r.get("stale_lock_recovered", 0) or 0) for r in r24),
        "no_op_runs": sum(int(r.get("no_op_runs", 0) or 0) for r in r24),
        "planned_commit": sum(int(r.get("planned_commit", 0) or 0) for r in r24),
        "planned_push": sum(int(r.get("planned_push", 0) or 0) for r in r24),
        "rebase_conflicts": sum(int(r.get("rebase_conflicts", 0) or 0) for r in r24),
        "remote_unreachable": sum(int(r.get("remote_unreachable", 0) or 0) for r in r24),
    }

    # Schedule is every 4h -> expected 6 runs; accept >=5
    ready = (
        agg["runs"] >= 5 and
        agg["remote_unreachable"] == 0 and
        agg["rebase_conflicts"] == 0 and
        agg["stale_lock_recovered"] == 0
    )

    out = {
        "ts": now.isoformat().replace("+00:00", "Z"),
        "window": "24h",
        "metrics": agg,
        "recommendation": "READY" if ready else "NOT_READY",
        "phased_disable_legacy": ["ce006db5 (auto-commit)", "db2dc5f6 (auto-push)", "b0c35166 (backup git)"] if ready else [],
    }

    print(json.dumps({"ok": True, "summary": out}, ensure_ascii=False))


if __name__ == "__main__":
    main()
