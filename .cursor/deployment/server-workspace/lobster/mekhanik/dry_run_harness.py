#!/usr/bin/env python3
"""Dry-run harness for Lobster Mekhanik (approval-heavy).

Focus:
- classify actions into safe_auto / risky / blocked
- restart-loop guard, retry budget, circuit breaker
- dedupe same incident (id/type/job)

All actions are planned only.
"""

from __future__ import annotations

import json
import time


SAFE_AUTO = {"restart_gateway", "cron_run_monitor"}
RISKY = {"run_hetzner_snapshot", "modify_cron_job", "git_commit_push", "delete_remote_resource"}
BLOCKED = {"rm_files", "auto_force_push", "change_model"}


class WindowCounter:
    def __init__(self, window_s: int):
        self.window_s = window_s
        self.events: list[float] = []

    def add(self, now: float):
        self.events.append(now)

    def count(self, now: float) -> int:
        cut = now - self.window_s
        self.events = [t for t in self.events if t >= cut]
        return len(self.events)


class RestartGuard(WindowCounter):
    pass


class CircuitBreaker(WindowCounter):
    pass


def decide(incident: dict) -> dict:
    t = incident.get("type")
    if t == "gateway_down":
        return {"plan": [{"kind": "restart_gateway", "class": "safe_auto", "approval_required": False}]}
    if t == "snapshot_stale":
        return {"plan": [{"kind": "run_hetzner_snapshot", "class": "risky", "approval_required": True}]}
    if t == "cron_error":
        return {"plan": [{"kind": "modify_cron_job", "class": "risky", "approval_required": True}]}
    return {"plan": [{"kind": "escalate", "class": "safe_auto", "approval_required": False}]}


def apply_policies(plan: list[dict], now: float, restart_guard: RestartGuard, attempts: dict, cb: CircuitBreaker) -> tuple[list[dict], list[dict]]:
    incidents = []

    # circuit breaker
    if cb.count(now) >= 3:
        incidents.append({"type": "mekhanik_circuit_breaker", "severity": "critical"})
        for a in plan:
            a["allowed"] = False
            a["reason"] = "circuit_breaker"
        return incidents, plan

    for a in plan:
        k = a["kind"]
        if k in BLOCKED:
            a.update({"allowed": False, "reason": "blocked_mvp"})
        elif k in RISKY:
            a.update({"allowed": False, "reason": "approval_required"})
        elif k in SAFE_AUTO:
            if k == "restart_gateway":
                if restart_guard.count(now) >= 2:
                    a.update({"allowed": False, "reason": "restart_loop_blocked"})
                    incidents.append({"type": "restart_loop_blocked", "severity": "critical"})
                else:
                    restart_guard.add(now)
                    a.update({"allowed": True})
            else:
                a.update({"allowed": True})
        else:
            a.update({"allowed": False, "reason": "unknown_action"})

    return incidents, plan


def run_case(name: str, incident: dict, now: float, state: dict) -> dict:
    # dedupe
    key = (incident.get("id"), incident.get("type"), incident.get("job"))
    if key in state["seen"]:
        return {"name": name, "actual": {"deduped": True, "plan": [], "incidents": []}}
    state["seen"].add(key)

    d = decide(incident)
    plan = d["plan"]

    # retry budget
    inc_id = incident.get("id") or f"{incident.get('type')}:{incident.get('job','') }"
    state["attempts"].setdefault(inc_id, 0)
    if state["attempts"][inc_id] >= 2:
        state["cb"].add(now)
        return {"name": name, "actual": {"plan": plan, "incidents": [{"type": "retry_budget_exceeded", "severity": "critical"}], "actions": []}}

    pol_inc, plan2 = apply_policies(plan, now, state["rg"], state["attempts"], state["cb"])

    # simulate failure increments for a specific test flag
    if incident.get("simulate_fail"):
        state["attempts"][inc_id] += 1
        state["cb"].add(now)

    return {"name": name, "actual": {"plan": plan2, "incidents": pol_inc, "attempts": state["attempts"][inc_id]}}


def main() -> None:
    base = time.time()
    state = {
        "seen": set(),
        "attempts": {},
        "rg": RestartGuard(window_s=30 * 60),
        "cb": CircuitBreaker(window_s=30 * 60),
    }

    cases = [
        {
            "name": "single_recoverable_gateway_down",
            "incident": {"id": "i1", "type": "gateway_down", "severity": "critical"},
            "expected": "restart allowed",
        },
        {
            "name": "repeated_same_critical_dedupe",
            "incident": {"id": "i1", "type": "gateway_down", "severity": "critical"},
            "expected": "deduped",
        },
        {
            "name": "risky_requires_approval",
            "incident": {"id": "i2", "type": "snapshot_stale", "severity": "critical"},
            "expected": "plan risky blocked",
        },
        {
            "name": "circuit_breaker_after_failures",
            "incident": {"id": "i3", "type": "gateway_down", "severity": "critical", "simulate_fail": True},
            "expected": "eventually circuit breaker",
        },
        {
            "name": "malformed_incident",
            "incident": {"type": None},
            "expected": "escalate/blocked unknown",
        },
    ]

    report = []
    report.append(run_case(cases[0]["name"], cases[0]["incident"], base, state))
    report.append(run_case(cases[1]["name"], cases[1]["incident"], base + 60, state))
    report.append(run_case(cases[2]["name"], cases[2]["incident"], base + 120, state))

    # force multiple failures to trip breaker
    report.append(run_case("fail1", {"id": "f1", "type": "gateway_down", "severity": "critical", "simulate_fail": True}, base + 180, state))
    report.append(run_case("fail2", {"id": "f2", "type": "gateway_down", "severity": "critical", "simulate_fail": True}, base + 240, state))
    report.append(run_case("fail3", {"id": "f3", "type": "gateway_down", "severity": "critical", "simulate_fail": True}, base + 300, state))
    report.append(run_case(cases[3]["name"], cases[3]["incident"], base + 360, state))

    report.append(run_case(cases[4]["name"], cases[4]["incident"], base + 420, state))

    out = {"ok": True, "action_classes": {"safe_auto": sorted(SAFE_AUTO), "risky": sorted(RISKY), "blocked": sorted(BLOCKED)}, "report": report}
    out_path = "/home/openclaw/.openclaw/workspace/lobster/mekhanik/dry-run-report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(json.dumps({"ok": True, "out": out_path}, ensure_ascii=False))


if __name__ == "__main__":
    main()
