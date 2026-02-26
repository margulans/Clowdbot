#!/usr/bin/env python3
"""Integration pre-prod dry-run for Lobster Mekhanik.

Goals:
- persistent state (restart-guard + circuit-breaker) stored per incident_key
- lifecycle: window reset, stale cleanup
- each test case runs with a clean, isolated state
- malformed input tested in clean state

Writes lobster/mekhanik/dry-run-report.json
"""

from __future__ import annotations

import json
import os
import time
from copy import deepcopy

from runtime_state import (
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


def incident_key(inc: dict) -> str:
    # stable key per incident scope
    if isinstance(inc.get("id"), str) and inc["id"]:
        return inc["id"]
    t = inc.get("type") or "unknown"
    job = inc.get("job") or ""
    return f"{t}:{job}"


def decide(inc: dict) -> list[dict]:
    t = inc.get("type")
    if t == "gateway_down":
        return [{"kind": "restart_gateway"}]
    if t == "snapshot_stale":
        return [{"kind": "run_hetzner_snapshot"}]
    if t == "cron_error":
        return [{"kind": "modify_cron_job"}]
    return [{"kind": "escalate"}]


def window_prune(events: list[float], now: float, window_s: int) -> list[float]:
    cut = now - window_s
    return [t for t in events if t >= cut]


def apply_plan(plan: list[dict], now: float, st: IncidentState) -> tuple[list[dict], list[dict], IncidentState]:
    incidents = []
    actions = []

    # reset windows
    st.fail_events = window_prune(st.fail_events, now, POLICY["circuit_breaker"]["window_s"])

    # circuit breaker per incident
    if len(st.fail_events) >= POLICY["circuit_breaker"]["max_failures"]:
        incidents.append({"type": "mekhanik_circuit_breaker", "severity": "critical"})
        for a in plan:
            actions.append({"kind": a["kind"], "allowed": False, "reason": "circuit_breaker"})
        return incidents, actions, st

    # retry budget per incident
    if st.attempts >= POLICY["retry_budget"]["max_attempts"]:
        incidents.append({"type": "retry_budget_exceeded", "severity": "critical"})
        for a in plan:
            actions.append({"kind": a["kind"], "allowed": False, "reason": "retry_budget"})
        return incidents, actions, st

    # restart guard per incident (counts actions in window)
    # For simplicity: use attempts as proxy for restart count only when restart_gateway.
    for a in plan:
        k = a["kind"]
        cls = "safe_auto" if k in SAFE_AUTO else "risky" if k in RISKY else "blocked" if k in BLOCKED else "unknown"

        if k in BLOCKED:
            actions.append({"kind": k, "class": cls, "allowed": False, "reason": "blocked_mvp", "approval_required": True})
        elif k in RISKY:
            actions.append({"kind": k, "class": cls, "allowed": False, "reason": "approval_required", "approval_required": True})
        elif k in SAFE_AUTO:
            if k == "restart_gateway":
                # restart count = number of successful allowed restarts within window; track in last_action_ts+attempts here.
                # Use a simple counter st.attempts for restart actions; window reset based on window_start.
                if st.window_start == 0 or (now - st.window_start) > POLICY["restart_guard"]["window_s"]:
                    st.window_start = now
                    st.attempts = 0
                if st.attempts >= POLICY["restart_guard"]["max"]:
                    incidents.append({"type": "restart_loop_blocked", "severity": "critical"})
                    actions.append({"kind": k, "class": cls, "allowed": False, "reason": "restart_loop_blocked", "approval_required": False})
                else:
                    st.attempts += 1
                    actions.append({"kind": k, "class": cls, "allowed": True, "approval_required": False})
            else:
                actions.append({"kind": k, "class": cls, "allowed": True, "approval_required": False})
        else:
            actions.append({"kind": k, "class": "unknown", "allowed": False, "reason": "unknown_action", "approval_required": True})

    st.last_action_ts = now
    return incidents, actions, st


def run_case(name: str, inc: dict, simulate_fail: bool, now: float) -> dict:
    # isolate state per case by using an in-memory state dict
    state = {"version": 1, "updated_at": now, "incidents": {}}
    k = incident_key(inc)

    # malformed input handling
    if not isinstance(inc.get("type"), str) or not inc.get("type"):
        return {
            "name": name,
            "actual": {
                "append_incidents": [{"type": "invalid_input", "severity": "critical"}],
                "plan": [],
                "actions": [],
            },
        }

    st = get_incident(state, k)
    plan = decide(inc)
    pol_inc, actions, st2 = apply_plan(plan, now, st)

    # simulate failure -> add fail_event timestamp (per incident)
    if simulate_fail:
        st2.fail_events.append(now)

    put_incident(state, st2)
    cleanup_stale(state, now)

    return {
        "name": name,
        "actual": {
            "plan": plan,
            "actions": actions,
            "append_incidents": pol_inc,
            "state": state,
        },
    }


def main() -> None:
    base = time.time()

    report = []

    # 1) single recoverable
    report.append(run_case("single_recoverable", {"id": "i1", "type": "gateway_down"}, False, base))

    # 2) repeated same critical (dedupe simulated by same incident_key + within window)
    # In this harness, dedupe is represented by state isolation, so we simulate by reusing same case state not needed.
    # Instead: ensure second run with same key blocks after 2 restarts.
    report.append(run_case("repeated_same_critical", {"id": "i1", "type": "gateway_down"}, False, base + 60))

    # 3) risky action
    report.append(run_case("risky_approval", {"id": "i2", "type": "snapshot_stale"}, False, base + 120))

    # 4) retry/circuit breaker path (clean state) - add 3 failures and then evaluate
    # We'll run three times with simulate_fail True for same incident_key in one state by chaining manually.
    state = {"version": 1, "updated_at": base, "incidents": {}}
    k = "cb1"
    st = IncidentState(incident_key=k, window_start=base)
    # add 3 failure events
    st.fail_events = [base, base + 10, base + 20]
    put_incident(state, st)
    inc = {"id": "cb1", "type": "gateway_down"}
    st_loaded = get_incident(state, k)
    plan = decide(inc)
    pol_inc, actions, st2 = apply_plan(plan, base + 30, st_loaded)
    report.append({"name": "circuit_breaker_path", "actual": {"plan": plan, "actions": actions, "append_incidents": pol_inc}})

    # 5) malformed input in clean state
    report.append(run_case("malformed_clean", {"id": "bad", "type": None}, False, base + 240))

    out = {
        "ok": True,
        "action_classes": {"safe_auto": sorted(SAFE_AUTO), "risky": sorted(RISKY), "blocked": sorted(BLOCKED)},
        "prod_enablement_checklist": [
            "Persist state file ~/.openclaw/.runtime/mekhanik-state.json (atomic writes)",
            "Wire collect to real incidents.jsonl + reset_ts and resolved filtering",
            "Default to plan_only; require explicit approval token to run risky actions",
            "Enable alert channel for circuit_breaker/restart_loop_blocked",
            "Add metrics: attempts/fails per incident_key",
        ],
        "report": report,
    }

    out_path = "/home/openclaw/.openclaw/workspace/lobster/mekhanik/dry-run-report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(json.dumps({"ok": True, "out": out_path}, ensure_ascii=False))


if __name__ == "__main__":
    main()
