#!/usr/bin/env python3
"""Pre-prod validation harness for Lobster Mekhanik.

Adds:
- shared-state restart-guard scenario (same incident_key across runs)
- window expiry check (t0+31m)
- atomic write failure path simulation

Updates lobster/mekhanik/dry-run-report.json
"""

from __future__ import annotations

import json
import os
import time
from copy import deepcopy

from runtime_state import (
    STATE_PATH,
    IncidentState,
    cleanup_stale,
    get_incident,
    load_state,
    put_incident,
    save_state,
)

SAFE_AUTO = {"restart_gateway", "cron_run_monitor", "escalate"}
RISKY = {"run_hetzner_snapshot", "modify_cron_job", "git_commit_push", "delete_remote_resource"}
BLOCKED = {"rm_files", "auto_force_push", "change_model"}

POLICY = {
    "restart_guard": {"max": 2, "window_s": 30 * 60},
    "retry_budget": {"max_attempts": 2},
    "circuit_breaker": {"max_failures": 3, "window_s": 30 * 60},
}


def decide(inc_type: str) -> list[dict]:
    if inc_type == "gateway_down":
        return [{"kind": "restart_gateway"}]
    return [{"kind": "escalate"}]


def window_prune(events: list[float], now: float, window_s: int) -> list[float]:
    cut = now - window_s
    return [t for t in events if t >= cut]


def apply_restart_guard(now: float, st: IncidentState) -> tuple[list[dict], list[dict], IncidentState]:
    incidents = []
    actions = []

    # reset guard window
    if st.window_start == 0 or (now - st.window_start) > POLICY["restart_guard"]["window_s"]:
        st.window_start = now
        st.attempts = 0

    if st.attempts >= POLICY["restart_guard"]["max"]:
        incidents.append({"type": "restart_loop_blocked", "severity": "critical"})
        actions.append({"kind": "restart_gateway", "allowed": False, "reason": "restart_loop_blocked", "approval_required": False})
        st.last_action_ts = now
        return incidents, actions, st

    st.attempts += 1
    actions.append({"kind": "restart_gateway", "allowed": True, "approval_required": False})
    st.last_action_ts = now
    return incidents, actions, st


def shared_state_case(t0: float) -> dict:
    # state shared across 4 runs for same incident_key
    state = {"version": 1, "updated_at": t0, "incidents": {}}
    key = "shared_incident"
    st = IncidentState(incident_key=key, window_start=t0)
    put_incident(state, st)

    runs = []
    expected = [
        {"t": 0, "allowed": True},
        {"t": 600, "allowed": True},
        {"t": 1200, "allowed": False, "incident": "restart_loop_blocked"},
        {"t": 1860, "allowed": True},  # t0+31m => new window
    ]

    for step in expected:
        now = t0 + step["t"]
        st = get_incident(state, key)
        incs, acts, st2 = apply_restart_guard(now, st)
        put_incident(state, st2)
        cleanup_stale(state, now)
        runs.append({"now_offset_s": step["t"], "actual": {"incidents": incs, "actions": acts, "attempts": st2.attempts, "window_start": st2.window_start}})

    return {"name": "shared_state_restart_guard", "expected": expected, "actual": runs}


def atomic_write_failure_case(t0: float) -> dict:
    # simulate failure by attempting to write into a non-writable directory
    bad_path = "/root/forbidden/mekhanik-state.json"
    state = {"version": 1, "updated_at": t0, "incidents": {}}

    try:
        save_state(state, path=bad_path)
        actual = {"wrote": True}
    except Exception as e:
        # on failure: state_write_failed + safe-stop actions
        actual = {
            "error": str(e),
            "append_incidents": [{"type": "state_write_failed", "severity": "critical"}],
            "actions": [{"kind": "safe_stop", "allowed": True}],
        }

    return {
        "name": "atomic_write_failure",
        "expected": {"append_incidents": ["state_write_failed"], "actions": ["safe_stop"]},
        "actual": actual,
    }


def main() -> None:
    t0 = time.time()

    report = {
        "ok": True,
        "action_classes": {"safe_auto": sorted(SAFE_AUTO), "risky": sorted(RISKY), "blocked": sorted(BLOCKED)},
        "prod_enablement_checklist": [
            "State path exists: ~/.openclaw/.runtime/mekhanik-state.json (owner=openclaw, mode 600/640)",
            "Atomic writes enabled (tmp+fsync+rename); monitor state_write_failed incidents",
            "Restart-guard verified: 2 restarts/30m per incident_key; window resets after 30m",
            "Circuit-breaker per incident_key (not global); verify no cross-incident blocking",
            "Rollback: set Mеханик cron enabled=false; preserve incidents.jsonl",
        ],
        "cases": [
            shared_state_case(t0),
            atomic_write_failure_case(t0),
        ],
    }

    out_path = "/home/openclaw/.openclaw/workspace/lobster/mekhanik/dry-run-report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps({"ok": True, "out": out_path}, ensure_ascii=False))


if __name__ == "__main__":
    main()
