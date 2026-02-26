#!/usr/bin/env python3
"""Post-check decision gate for Economist plan-only soak (24h)."""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone

METRICS = os.path.expanduser(os.environ.get("ECON_SOAK_METRICS", "~/.openclaw/.runtime/economist-lobster-metrics.jsonl"))
INCIDENTS = os.path.expanduser(os.environ.get("ECON_SOAK_INCIDENTS", "~/.openclaw/workspace/data/incidents.jsonl"))
SESSIONS_JSON = os.path.expanduser(os.environ.get("ECON_SOAK_SESSIONS", "~/.openclaw/agents/main/sessions/sessions.json"))


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


def append_incident(obj: dict) -> None:
    os.makedirs(os.path.dirname(INCIDENTS), exist_ok=True)
    with open(INCIDENTS, 'a', encoding='utf-8') as f:
        f.write(json.dumps(obj, ensure_ascii=False) + '\n')


def sample_malformed_keys(limit: int = 5) -> list[str]:
    # Best-effort: find 3–5 examples of sessions missing model/modelProvider.
    try:
        with open(SESSIONS_JSON, 'r', encoding='utf-8') as f:
            sessions = json.load(f)
        out = []
        for k, s in sessions.items():
            if not isinstance(s, dict):
                continue
            model = s.get('model') or s.get('modelProvider')
            if not isinstance(model, str) or not model.strip():
                out.append(str(k))
                if len(out) >= limit:
                    break
        return out
    except Exception:
        return []


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
    malformed_ratio = agg["malformed_ratio"]
    data_quality_ok = (malformed_ratio <= 0.05)

    dq_incident = None
    if malformed_ratio > 0.05:
        sev = "warn" if malformed_ratio <= 0.1 else "critical"
        examples = sample_malformed_keys(limit=5)
        dq_incident = {
            "ts": now.isoformat().replace("+00:00", "Z"),
            "type": "economist_data_quality_degraded",
            "source": "economist-soak-post-check",
            "severity": sev,
            "detail": {
                "total_sessions": agg["total_sessions"],
                "malformed_session_count": agg["malformed_session_count"],
                "malformed_ratio": malformed_ratio,
                "examples": examples,
            },
            "resolved": False,
        }
        append_incident(dq_incident)

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
        "data_quality_incident_written": bool(dq_incident),
        "recommendation": "READY" if ready else "NOT_READY",
        "next_enablement": {
            "real_persist": "enable only after confirmation; should write economist-log.jsonl + cost-summary.json atomically",
            "weekly_report": "approval-only message(action=send) + never auto-switch models",
        },
    }

    print(json.dumps({"ok": True, "summary": out}, ensure_ascii=False))


if __name__ == "__main__":
    main()
