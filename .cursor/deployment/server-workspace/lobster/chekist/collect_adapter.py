#!/usr/bin/env python3
"""Read-only collect adapter for Lobster Chekist.

- Reads incidents.jsonl and selects records from last N minutes
- Applies resolved filtering (resolved events close incidents)
- Fetches cron state (either from injected JSON for tests, or via `openclaw cron list --json`)
- Emits normalized JSON for downstream rules

This is intentionally deterministic and LLM-free.
"""

from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_ts(ts: str) -> datetime:
    # Accepts ISO like 2026-02-26T00:00:00Z
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    return datetime.fromisoformat(ts)


def floor_time(dt: datetime, minutes: int) -> datetime:
    # floor to bucket
    epoch = int(dt.timestamp())
    bucket_s = minutes * 60
    floored = (epoch // bucket_s) * bucket_s
    return datetime.fromtimestamp(floored, tz=timezone.utc)


@dataclass
class CollectConfig:
    incidents_path: str = "/home/openclaw/.openclaw/workspace/data/incidents.jsonl"
    window_minutes: int = 60
    cron_json_path: str | None = None  # for tests


def read_jsonl(path: str) -> list[dict[str, Any]]:
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
                # skip malformed line
                continue
    return out


def resolved_filter(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # Build resolved_ref_ids per Chekist SKILL.md semantics.
    resolved_ids: set[str] = set()
    for e in events:
        if e.get("type") == "resolved":
            ref = e.get("ref_id")
            if isinstance(ref, str) and ref:
                resolved_ids.add(ref)

    def close_key(e: dict[str, Any]) -> str | None:
        if isinstance(e.get("id"), str) and e.get("id"):
            return e["id"]
        if isinstance(e.get("ref_id"), str) and e.get("ref_id"):
            return e["ref_id"]
        t = e.get("type")
        s = e.get("source")
        if isinstance(t, str) and isinstance(s, str):
            return f"{t}:{s}"
        return None

    active = []
    for e in events:
        # Skip resolved rows themselves
        if e.get("type") == "resolved":
            continue
        k = close_key(e)
        if k and k in resolved_ids:
            continue
        active.append(e)
    return active


def fetch_cron_jobs(cron_json_path: str | None = None) -> list[dict[str, Any]]:
    if cron_json_path:
        with open(cron_json_path, "r", encoding="utf-8") as f:
            obj = json.load(f)
        return obj.get("jobs", [])

    # Use CLI (read-only)
    res = subprocess.run(
        ["openclaw", "cron", "list", "--json"],
        capture_output=True,
        text=True,
        timeout=20,
    )
    if res.returncode != 0:
        raise RuntimeError(f"cron list failed: {res.stderr.strip()[:400]}")
    obj = json.loads(res.stdout)
    return obj.get("jobs", [])


def normalize_state(ts: str, incidents_recent: list[dict[str, Any]], cron_jobs: list[dict[str, Any]]) -> dict[str, Any]:
    cron_errors = []
    for j in cron_jobs:
        st = (j.get("state") or {})
        if st.get("lastStatus") == "error" or (st.get("consecutiveErrors") or 0) > 0:
            cron_errors.append({
                "jobId": j.get("id"),
                "job": j.get("name"),
                "lastStatus": st.get("lastStatus"),
                "consecutiveErrors": st.get("consecutiveErrors"),
                "lastRunAtMs": st.get("lastRunAtMs"),
                "model": (j.get("payload") or {}).get("model"),
            })

    # config_drift signal if any active config_drift incident exists
    config_drift = any(e.get("type") == "config_drift" for e in incidents_recent)

    return {
        "ts": ts,
        "window_minutes": 60,
        "incidents_recent": incidents_recent,
        "cron_errors": cron_errors,
        "config_drift": config_drift,
    }


def collect(config: CollectConfig) -> dict[str, Any]:
    now = _utcnow()
    since = now - timedelta(minutes=config.window_minutes)

    all_events = read_jsonl(config.incidents_path)
    recent = []
    for e in all_events:
        ts = e.get("ts")
        if not isinstance(ts, str):
            continue
        try:
            dt = parse_ts(ts)
        except Exception:
            continue
        if dt >= since:
            recent.append(e)

    recent_active = resolved_filter(recent)
    cron_jobs = fetch_cron_jobs(config.cron_json_path)

    ts_out = now.isoformat().replace("+00:00", "Z")
    return normalize_state(ts_out, recent_active, cron_jobs)


def main() -> None:
    cfg = CollectConfig(
        incidents_path=os.environ.get("CHEKIST_INCIDENTS", CollectConfig.incidents_path),
        window_minutes=int(os.environ.get("CHEKIST_WINDOW_MIN", "60")),
        cron_json_path=os.environ.get("CHEKIST_CRON_JSON"),
    )
    state = collect(cfg)
    print(json.dumps({"ok": True, "state": state}, ensure_ascii=False))


if __name__ == "__main__":
    main()
