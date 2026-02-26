#!/usr/bin/env python3
"""Integration-level dry-run for Lobster Chekist.

Uses collect_adapter (parsing JSONL + resolved filtering) and implements:
- incident append dedupe
- alert dedupe (type, scope_id, normalizedWindowTs) with 180m window

All actions are dry-run (no real message/send/append).
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone

from collect_adapter import CollectConfig, collect as collect_state, parse_ts, floor_time


class WindowDedupe:
    def __init__(self, window_s: int):
        self.window_s = window_s
        self.seen: dict[tuple, float] = {}

    def allow(self, k: tuple, now: float) -> bool:
        cut = now - self.window_s
        self.seen = {kk: ts for kk, ts in self.seen.items() if ts >= cut}
        if k in self.seen:
            return False
        self.seen[k] = now
        return True


def alert_key(alert_type: str, scope_id: str, ts_iso: str, bucket_min: int = 60) -> tuple:
    dt = parse_ts(ts_iso)
    bucket = floor_time(dt, bucket_min).isoformat().replace("+00:00", "Z")
    return (alert_type, scope_id, bucket)


def run_rules(state: dict, now: float, inc_dedupe: WindowDedupe, alert_dedupe: WindowDedupe) -> dict:
    append_incidents = []
    alerts = []

    # append cron_error incidents (dedupe by lastRunAtMs)
    for e in state.get("cron_errors", []):
        k = ("cron_error", e.get("jobId"), e.get("lastRunAtMs"))
        if inc_dedupe.allow(k, now):
            append_incidents.append({
                "type": "cron_error",
                "severity": "critical",
                "jobId": e.get("jobId"),
                "lastRunAtMs": e.get("lastRunAtMs"),
            })

        # alert dedupe (cron_error)
        scope = str(e.get("jobId"))
        ak = alert_key("cron_error", scope, state["ts"])
        if alert_dedupe.allow(ak, now):
            alerts.append({"type": "cron_error", "scope_id": scope, "allowed": True, "dry_run_disabled": True})
        else:
            alerts.append({"type": "cron_error", "scope_id": scope, "allowed": False, "reason": "deduped"})

    # config_drift alert dedupe (scope_id=source)
    if state.get("config_drift"):
        scope = "config_drift"
        ak = alert_key("config_drift", scope, state["ts"])
        if alert_dedupe.allow(ak, now):
            alerts.append({"type": "config_drift", "scope_id": scope, "allowed": True, "dry_run_disabled": True})
        else:
            alerts.append({"type": "config_drift", "scope_id": scope, "allowed": False, "reason": "deduped"})

    heartbeat = None
    if not state.get("cron_errors") and not state.get("config_drift") and not state.get("incidents_recent"):
        heartbeat = {"type": "heartbeat", "source": "chekist", "status": "ok"}

    return {"append_incidents": append_incidents, "alerts": alerts, "heartbeat": heartbeat, "audit": {"ts": state["ts"]}}


def write_jsonl(path: str, rows: list[dict]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def main() -> None:
    base = time.time()
    inc_dedupe = WindowDedupe(window_s=180 * 60)
    alert_dedupe = WindowDedupe(window_s=180 * 60)

    tmp_dir = "/tmp/lobster-chekist"
    os.makedirs(tmp_dir, exist_ok=True)

    # Prepare a minimal cron-jobs fixture
    cron_ok = {"jobs": []}
    cron_err = {
        "jobs": [
            {"id": "job1", "name": "Job 1", "state": {"lastStatus": "error", "consecutiveErrors": 2, "lastRunAtMs": 111}, "payload": {"model": "x"}},
        ]
    }

    def run_case(name: str, incidents_rows: list[dict], cron_obj: dict, t: float, expect: dict):
        inc_path = os.path.join(tmp_dir, f"{name}.incidents.jsonl")
        cron_path = os.path.join(tmp_dir, f"{name}.cron.json")
        write_jsonl(inc_path, incidents_rows)
        with open(cron_path, "w", encoding="utf-8") as f:
            json.dump(cron_obj, f)

        cfg = CollectConfig(incidents_path=inc_path, window_minutes=60, cron_json_path=cron_path)
        state = collect_state(cfg)
        out = run_rules(state, t, inc_dedupe, alert_dedupe)
        return {"name": name, "expected": expect, "actual": out}

    # 1) single cron_error
    r1 = run_case(
        "single_cron_error",
        incidents_rows=[],
        cron_obj=cron_err,
        t=base,
        expect={"append_incidents": 1, "alerts_allowed": 1},
    )

    # 2) repeated cron_error (same lastRunAtMs) -> suppress alert + suppress append
    r2 = run_case(
        "repeated_cron_error",
        incidents_rows=[],
        cron_obj=cron_err,
        t=base + 60,
        expect={"append_incidents": 0, "alerts_allowed": 0},
    )

    # 3) config_drift critical (timestamp must be within 60m window)
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    r3 = run_case(
        "config_drift",
        incidents_rows=[{"ts": now_iso, "type": "config_drift", "source": "uchastkovy", "severity": "critical"}],
        cron_obj=cron_ok,
        t=base + 120,
        expect={"alerts_allowed": 1, "type": "config_drift"},
    )

    # 4) mixed resolved/unresolved (config_drift resolved -> no alert)
    now_iso2 = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    now_iso3 = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    r4 = run_case(
        "resolved_filter",
        incidents_rows=[
            {"ts": now_iso2, "id": "abcd1234", "type": "config_drift", "source": "uchastkovy", "severity": "critical"},
            {"ts": now_iso3, "type": "resolved", "ref_id": "abcd1234", "source": "uchastkovy"},
        ],
        cron_obj=cron_ok,
        t=base + 180,
        expect={"alerts_allowed": 0, "heartbeat": "ok"},
    )

    # 5) malformed input (bad JSONL line)
    bad_inc_path = os.path.join(tmp_dir, "malformed.incidents.jsonl")
    with open(bad_inc_path, "w", encoding="utf-8") as f:
        f.write("{not-json}\n")
    bad_cron_path = os.path.join(tmp_dir, "malformed.cron.json")
    with open(bad_cron_path, "w", encoding="utf-8") as f:
        f.write("{not-json}")

    try:
        cfg = CollectConfig(incidents_path=bad_inc_path, window_minutes=60, cron_json_path=bad_cron_path)
        state = collect_state(cfg)
        out = run_rules(state, base + 240, inc_dedupe, alert_dedupe)
        r5 = {"name": "malformed_input", "expected": {"invalid": True}, "actual": out}
    except Exception as e:
        r5 = {
            "name": "malformed_input",
            "expected": {"invalid": True},
            "actual": {"append_incidents": [{"type": "invalid_input", "severity": "critical", "msg": str(e)}], "alerts": [], "heartbeat": None},
        }

    report = {"ok": True, "report": [r1, r2, r3, r4, r5]}
    out_path = "/home/openclaw/.openclaw/workspace/lobster/chekist/dry-run-report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps({"ok": True, "out": out_path}, ensure_ascii=False))


if __name__ == "__main__":
    main()
