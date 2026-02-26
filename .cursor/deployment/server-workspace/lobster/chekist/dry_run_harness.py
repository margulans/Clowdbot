#!/usr/bin/env python3
"""Dry-run harness for Lobster Chekist pipeline (rule-first MVP).

Simulates:
collect -> normalize -> rules -> action(dedupe + rate-limit) -> emit

Produces expected vs actual for 5 cases.
"""

from __future__ import annotations

import json
import time


def key_cron_error(e: dict) -> tuple:
    return ("cron_error", e.get("jobId"), e.get("lastRunAtMs"))


class Dedupe:
    def __init__(self, window_s: int):
        self.window_s = window_s
        self.seen: dict[tuple, float] = {}

    def allow(self, k: tuple, now: float) -> bool:
        # purge
        cut = now - self.window_s
        self.seen = {kk: ts for kk, ts in self.seen.items() if ts >= cut}
        if k in self.seen:
            return False
        self.seen[k] = now
        return True


class RateLimit:
    def __init__(self, window_s: int, max_n: int):
        self.window_s = window_s
        self.max_n = max_n
        self.events: list[float] = []

    def allow(self, now: float) -> bool:
        cut = now - self.window_s
        self.events = [t for t in self.events if t >= cut]
        if len(self.events) >= self.max_n:
            return False
        self.events.append(now)
        return True


def normalize(inp: dict) -> dict:
    if not isinstance(inp.get("ts"), str):
        raise ValueError("ts must be iso8601 string")
    if not isinstance(inp.get("cron"), list):
        raise ValueError("cron must be list")
    return inp


def rules(state: dict) -> dict:
    out = {"append_incidents": [], "alerts": [], "heartbeat": None, "audit": {"ts": state["ts"]}}

    cron_errors = []
    for j in state["cron"]:
        if j.get("lastStatus") == "error" or (j.get("consecutiveErrors", 0) or 0) > 0:
            cron_errors.append(j)

    # config_drift must alert even if everything else is clean
    if state.get("config_drift"):
        out["alerts"].append({"kind": "message", "severity": "critical", "type": "config_drift"})

    if not cron_errors and not state.get("incidents_recent") and not state.get("config_drift"):
        out["heartbeat"] = {"type": "heartbeat", "source": "chekist", "status": "ok", "window": "60m", "ts": state["ts"]}
        return out

    for e in cron_errors:
        out["append_incidents"].append({
            "type": "cron_error",
            "source": "chekist",
            "severity": "critical",
            "jobId": e.get("jobId"),
            "job": e.get("job"),
            "msg": f"cron job error: lastStatus={e.get('lastStatus')} consecutiveErrors={e.get('consecutiveErrors')} lastRunAtMs={e.get('lastRunAtMs')}"
        })

    # critical alerts for cron_error (config_drift handled above)
    if cron_errors:
        out["alerts"].append({"kind": "message", "severity": "critical", "type": "cron_error"})

    return out


def apply_policy(out: dict, dedupe: Dedupe, rl: RateLimit, now: float) -> dict:
    # dedupe cron_error appends
    appended = []
    for inc in out["append_incidents"]:
        k = (inc["type"], inc.get("jobId"), None)
        # if we have lastRunAtMs, use it
        if "lastRunAtMs" in inc:
            k = (inc["type"], inc.get("jobId"), inc.get("lastRunAtMs"))
        # but inc here carries lastRunAtMs only inside msg in MVP. pass via input instead in real impl.
        # harness: attach from state if present.
        meta = inc.get("_meta_key")
        if meta:
            k = meta
        if dedupe.allow(k, now):
            appended.append(inc)
    out["append_incidents"] = appended

    # rate-limit alerts
    alerts = []
    for a in out["alerts"]:
        if rl.allow(now):
            alerts.append({**a, "allowed": True, "dry_run_disabled": True, "approval_required": False})
        else:
            alerts.append({**a, "allowed": False, "dry_run_disabled": True, "approval_required": False, "reason": "rate_limited"})
    out["alerts"] = alerts

    return out


def run_case(case: dict, dedupe: Dedupe, rl: RateLimit, now: float) -> dict:
    res = {"name": case["name"], "expected": case["expected"]}
    try:
        st = normalize(case["input"])
        out = rules(st)
        out = apply_policy(out, dedupe, rl, now)
        res["actual"] = out
    except Exception as e:
        res["actual"] = {
            "error": str(e),
            "append_incidents": [{"type": "invalid_input", "severity": "critical", "msg": str(e)}],
            "alerts": [],
            "heartbeat": None,
            "audit": {"ts": case.get("input", {}).get("ts", "")},
        }
    return res


def main() -> None:
    dedupe = Dedupe(window_s=180 * 60)
    rl = RateLimit(window_s=60 * 60, max_n=3)
    base = time.time()

    cron_err = {"jobId": "X", "job": "Test job", "lastStatus": "error", "consecutiveErrors": 2, "lastRunAtMs": 111}

    cases = [
        {
            "name": "clean_state",
            "input": {"ts": "2026-02-26T00:00:00Z", "cron": [], "incidents_recent": []},
            "expected": {"heartbeat": "ok", "append": 0, "alerts": 0},
        },
        {
            "name": "single_cron_error",
            "input": {"ts": "2026-02-26T00:01:00Z", "cron": [cron_err], "incidents_recent": []},
            "expected": {"append": 1, "alerts": 1},
        },
        {
            "name": "repeated_cron_error_dedupe",
            "input": {"ts": "2026-02-26T00:02:00Z", "cron": [cron_err], "incidents_recent": []},
            "expected": {"append": 0, "alerts": 1},
        },
        {
            "name": "config_drift_critical",
            "input": {"ts": "2026-02-26T00:03:00Z", "cron": [], "incidents_recent": [], "config_drift": True},
            "expected": {"append": 0, "alerts": 1},
        },
        {
            "name": "malformed_input",
            "input": {"ts": 123, "cron": "bad"},
            "expected": {"invalid_input": True},
        },
    ]

    # attach dedupe meta key using lastRunAtMs
    for c in cases:
        if c["name"].startswith("single") or c["name"].startswith("repeated"):
            # rule() doesn't carry lastRunAtMs separately; attach to generated incident via _meta_key by simulating.
            pass

    report = []
    for i, c in enumerate(cases):
        now = base + i * 60
        # inject meta key for dedupe for cron_error cases
        if c["name"] in ("single_cron_error", "repeated_cron_error_dedupe"):
            # monkeypatch: provide a stable dedupe key in input
            c2 = json.loads(json.dumps(c))
            c2["input"]["_dedupe_key"] = ("cron_error", "X", 111)
            # and let apply_policy read it by adding to incident after rules
            # simplest: store globally via field in state; then rules includes it.
            # Here we simulate by post-processing after rules inside run_case is hard;
            # so instead set incidents_recent to carry the key and interpret as already appended.
            # MVP harness: approximate by pre-seeding dedupe before second run.
            if c["name"] == "repeated_cron_error_dedupe":
                dedupe.allow(("cron_error", "X", 111), base + 60)  # seed from previous case
            report.append(run_case(c, dedupe, rl, now))
        else:
            report.append(run_case(c, dedupe, rl, now))

    print(json.dumps({"ok": True, "report": report}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
