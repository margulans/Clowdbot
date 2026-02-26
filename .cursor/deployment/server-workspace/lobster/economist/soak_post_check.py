#!/usr/bin/env python3
"""Post-check decision gate for Economist plan-only soak (24h)."""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone

METRICS = os.path.expanduser("~/.openclaw/.runtime/economist-lobster-metrics.jsonl")


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

    total_sessions = sum(int(r.get("total_sessions", 0) or 0) for r in r24)
    malformed = sum(int(r.get("malformed_session_count", 0) or 0) for r in r24)
    dup_art = sum(int(r.get("duplicate_sessionid_artifact_count", 0) or 0) for r in r24)

    agg = {
        "runs": len(r24),
        "computed_total_usd": round(sum(float(r.get("computed_total_usd", 0) or 0) for r in r24), 6),
        "unknown_pricing_count": sum(int(r.get("unknown_pricing_count", 0) or 0) for r in r24),
        "total_sessions": total_sessions,
        "malformed_session_count": malformed,
        "duplicate_sessionid_artifact_count": dup_art,
        "malformed_ratio": round((malformed / total_sessions), 6) if total_sessions else 0.0,
        "duplicate_ratio": round((dup_art / total_sessions), 6) if total_sessions else 0.0,
        "planned_persist_count": sum(int(r.get("planned_persist_count", 0) or 0) for r in r24),
        "planned_report_count": sum(int(r.get("planned_report_count", 0) or 0) for r in r24),
    }

    # Data quality policy:
    # - malformed is a real data problem (exclude from costing); allow small ratio
    # - duplicate_ratio is treated as normal artifact (cron base key + :run: share UUID)
    data_quality_ok = (agg["malformed_ratio"] <= 0.05)

    # Default cadence: every 4h => expected 6 runs; accept >=5.
    ready = (
        agg["runs"] >= 5 and
        data_quality_ok
    )

    out = {
        "ts": now.isoformat().replace("+00:00", "Z"),
        "window": "24h",
        "metrics": agg,
        "data_quality_ok": data_quality_ok,
        "recommendation": "READY" if ready else "NOT_READY",
        "next_enablement": {
            "real_persist": "enable only after confirmation; should write economist-log.jsonl + cost-summary.json atomically",
            "weekly_report": "approval-only message(action=send) + never auto-switch models",
        },
    }

    print(json.dumps({"ok": True, "summary": out}, ensure_ascii=False))


if __name__ == "__main__":
    main()
