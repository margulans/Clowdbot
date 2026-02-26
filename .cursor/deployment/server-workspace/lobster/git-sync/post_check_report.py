#!/usr/bin/env python3
"""24h decision-gate reporter for Lobster Git-sync plan-only soak."""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone

METRICS = os.path.expanduser("~/.openclaw/.runtime/git-sync-lobster-metrics.jsonl")
INCIDENTS = os.path.expanduser("~/.openclaw/workspace/data/incidents.jsonl")

# Scope classification
LOBSTER_SOURCES = {"git-sync-lobster", "lobster-git-sync"}
LOBSTER_JOB_IDS: set[str] = set()  # fill if/when lobster writes jobId-scoped incidents
LEGACY_JOB_IDS = {
    "ce006db5-350b-44be-baef-8b216ed687e4",  # Auto-commit: Git sync (legacy)
    "582cc3f0-9941-4e74-ae77-0afac52c6258",  # Вечерний дайджест @newsneiron (legacy)
    "89db97f7-e05e-4e3b-990b-fefc1815e7d7",  # 🕵️ Чекист (ночь) (legacy)
}


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


def classify_scope(inc: dict) -> str:
    """Return scope in {lobster, legacy, unknown}."""
    job_id = inc.get("jobId")
    src = inc.get("source")
    if src in LOBSTER_SOURCES or (isinstance(job_id, str) and job_id in LOBSTER_JOB_IDS):
        return "lobster"
    if isinstance(job_id, str) and job_id in LEGACY_JOB_IDS:
        return "legacy"
    return "unknown"


def scoped_incident_deltas(incidents: list[dict], since_ts: datetime) -> dict:
    total = lobster = legacy = unknown = 0
    for r in incidents:
        ts = r.get("ts")
        if not isinstance(ts, str):
            continue
        try:
            if parse_ts(ts) < since_ts:
                continue
        except Exception:
            continue
        total += 1
        scope = classify_scope(r)
        if scope == "lobster":
            lobster += 1
        elif scope == "legacy":
            legacy += 1
        else:
            unknown += 1
    return {
        "incidents_total_delta": total,
        "incidents_lobster_scoped_delta": lobster,
        "incidents_legacy_scoped_delta": legacy,
        "incidents_unknown_scoped_delta": unknown,
    }


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

    # Incidents: last 2h deltas (cutover-gate signal); legacy noise should not block.
    incidents = [r for r in read_jsonl(INCIDENTS) if isinstance(r.get("ts"), str)]
    deltas = scoped_incident_deltas(incidents, now - timedelta(hours=2))

    gate_status = "ok"
    if deltas["incidents_unknown_scoped_delta"] > 0:
        gate_status = "needs_review"
    if deltas["incidents_lobster_scoped_delta"] > 0:
        gate_status = "blocked"

    out = {
        "ts": now.isoformat().replace("+00:00", "Z"),
        "window": "24h",
        "metrics": agg,
        "incident_scope": deltas,
        "gate_status": gate_status,
        "recommendation": "READY" if (ready and gate_status == "ok") else ("NEEDS_REVIEW" if gate_status == "needs_review" else "NOT_READY"),
        "phased_disable_legacy": ["ce006db5 (auto-commit)", "db2dc5f6 (auto-push)", "b0c35166 (backup git)"] if (ready and gate_status == "ok") else [],
        "scope_examples": {
            "ce006db5": "legacy",
            "582cc3f0": "legacy",
            "89db97f7": "legacy",
        },
    }

    print(json.dumps({"ok": True, "summary": out}, ensure_ascii=False))


if __name__ == "__main__":
    main()
