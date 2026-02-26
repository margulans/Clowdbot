#!/usr/bin/env python3
"""Dry-run harness for Lobster uchastkovy pipeline.

Implements a minimal deterministic version of:
collect -> normalize -> rules -> action(policy) -> emit(simulated)

Outputs a JSON report with expected vs actual for 5 test cases.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass


@dataclass
class Policy:
    max_restarts: int = 2
    window_s: int = 30 * 60


class RestartLimiter:
    def __init__(self, policy: Policy):
        self.policy = policy
        self.events: list[float] = []

    def allow(self, now: float) -> bool:
        cut = now - self.policy.window_s
        self.events = [t for t in self.events if t >= cut]
        if len(self.events) >= self.policy.max_restarts:
            return False
        self.events.append(now)
        return True


def normalize(raw: dict) -> dict:
    # Hard validation / normalization.
    if not isinstance(raw.get("gateway_active"), bool):
        raise ValueError("gateway_active must be bool")
    disk = raw.get("disk_pct")
    if not isinstance(disk, (int, float)):
        raise ValueError("disk_pct must be number")
    if disk < 0 or disk > 100:
        raise ValueError("disk_pct out of range")
    return {
        "gateway_active": raw["gateway_active"],
        "disk_pct": float(disk),
        "probe_timeout": bool(raw.get("probe_timeout", False)),
    }


def rules(state: dict) -> tuple[list[dict], list[dict]]:
    incidents: list[dict] = []
    actions: list[dict] = []

    if state["probe_timeout"]:
        incidents.append({"type": "probe_failed", "severity": "warn", "msg": "probe timeout"})
        return incidents, actions

    if not state["gateway_active"]:
        incidents.append({"type": "gateway_down", "severity": "critical", "msg": "gateway inactive"})
        actions.append({"kind": "restart_gateway", "approval_required": False})

    if state["disk_pct"] > 85:
        incidents.append({"type": "disk_warn", "severity": "warn", "msg": f"disk {state['disk_pct']:.0f}%"})

    if not incidents:
        return [], [{"kind": "emit_heartbeat", "approval_required": False}]

    return incidents, actions


def apply_policy(actions: list[dict], limiter: RestartLimiter, now: float) -> tuple[list[dict], list[dict]]:
    incidents: list[dict] = []
    out: list[dict] = []
    for a in actions:
        if a["kind"] == "restart_gateway":
            if limiter.allow(now):
                out.append({**a, "allowed": True, "dry_run_disabled": False})
            else:
                out.append({**a, "allowed": False, "dry_run_disabled": True})
                incidents.append({"type": "restart_loop_blocked", "severity": "critical", "msg": "restart limit exceeded (2/30m)"})
        else:
            out.append({**a, "allowed": True, "dry_run_disabled": True if a["kind"].startswith("emit_") is False else False})
    return incidents, out


def run_case(case: dict, limiter: RestartLimiter, now: float) -> dict:
    res = {"name": case["name"], "expected": case["expected"]}
    try:
        st = normalize(case["input"])
        inc, act = rules(st)
        pol_inc, pol_act = apply_policy(act, limiter, now)
        inc = inc + pol_inc
        res["actual"] = {"incidents": inc, "actions": pol_act}
    except Exception as e:
        res["actual"] = {"error": str(e), "incidents": [{"type": "invalid_input", "severity": "critical", "msg": str(e)}], "actions": []}
    return res


def main() -> None:
    policy = Policy()
    limiter = RestartLimiter(policy)
    base = time.time()

    cases = [
        {
            "name": "normal",
            "input": {"gateway_active": True, "disk_pct": 17},
            "expected": {"incidents": [], "actions": ["emit_heartbeat"]},
        },
        {
            "name": "warning_disk",
            "input": {"gateway_active": True, "disk_pct": 86},
            "expected": {"incidents": ["disk_warn"], "actions": []},
        },
        {
            "name": "critical_gateway_down",
            "input": {"gateway_active": False, "disk_pct": 20},
            "expected": {"incidents": ["gateway_down"], "actions": ["restart_gateway"]},
        },
        {
            "name": "timeout_probe",
            "input": {"gateway_active": True, "disk_pct": 20, "probe_timeout": True},
            "expected": {"incidents": ["probe_failed"], "actions": []},
        },
        {
            "name": "invalid_input",
            "input": {"gateway_active": "yes", "disk_pct": 20},
            "expected": {"incidents": ["invalid_input"], "actions": []},
        },
    ]

    report = []
    # Extra: simulate restart-loop by running gateway_down 3 times within window.
    report.append(run_case(cases[0], limiter, base))
    report.append(run_case(cases[1], limiter, base))
    report.append(run_case(cases[2], limiter, base))
    report.append(run_case(cases[2], limiter, base + 60))
    report.append(run_case(cases[2], limiter, base + 120))  # should be blocked

    # Also run timeout + invalid
    report.append(run_case(cases[3], limiter, base))
    report.append(run_case(cases[4], limiter, base))

    print(json.dumps({"ok": True, "policy": policy.__dict__, "report": report}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
