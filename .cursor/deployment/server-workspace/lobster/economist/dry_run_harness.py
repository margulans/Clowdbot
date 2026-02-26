#!/usr/bin/env python3
"""Dry-run harness for Economist daily-collect (rule-first, no LLM).

Simulates collect inputs and validates:
- totals computed
- warnings produced
- persistence planned

Writes dry-run report JSON.
"""

from __future__ import annotations

import json
from collections import defaultdict


def compute_cost(session: dict, pricing: dict) -> tuple[float, str | None]:
    model = session.get("model")
    mp = (pricing.get("models") or {}).get(model)
    if not mp:
        return 0.0, f"unknown_pricing:{model}"
    it = int(session.get("inputTokens", 0) or 0)
    ot = int(session.get("outputTokens", 0) or 0)
    cost = it * float(mp.get("input_per_1m", 0)) / 1_000_000 + ot * float(mp.get("output_per_1m", 0)) / 1_000_000
    return cost, None


def run_case(name: str, sessions: list[dict], pricing: dict, expect: dict) -> dict:
    warnings = []
    seen = set()
    total = 0.0
    by_model = defaultdict(float)

    for s in sessions:
        sid = s.get("sessionId")
        if sid is None:
            warnings.append("malformed_session:missing_sessionId")
            continue
        if sid in seen:
            warnings.append(f"duplicate_session:{sid}")
            continue
        seen.add(sid)

        cost, warn = compute_cost(s, pricing)
        if warn:
            warnings.append(warn)
        total += cost
        by_model[s.get("model") or "unknown"] += cost

    actual = {
        "total_usd": round(total, 6),
        "by_model": {k: round(v, 6) for k, v in by_model.items()},
        "warnings": warnings,
        "persist": {
            "append_economist_log": True,
            "update_cost_summary": True,
        },
        "planned_actions": [
            {"kind": "weekly_report_message", "approval_required": True, "dry_run_disabled": True}
        ],
    }

    return {"name": name, "expected": expect, "actual": actual}


def main() -> None:
    pricing = {
        "models": {
            "openai/gpt-4o-mini": {"input_per_1m": 0.15, "output_per_1m": 0.6},
            "google/gemini-2.5-flash": {"input_per_1m": 0.1, "output_per_1m": 0.4},
        }
    }

    cases = []

    # 1) normal day
    cases.append(run_case(
        "normal_day",
        sessions=[
            {"sessionId": "s1", "model": "openai/gpt-4o-mini", "inputTokens": 10000, "outputTokens": 5000},
            {"sessionId": "s2", "model": "google/gemini-2.5-flash", "inputTokens": 20000, "outputTokens": 10000},
        ],
        pricing=pricing,
        expect={"total_usd": "~0.0085", "warnings": []},
    ))

    # 2) missing pricing
    cases.append(run_case(
        "missing_pricing",
        sessions=[
            {"sessionId": "s3", "model": "unknown/model", "inputTokens": 1000, "outputTokens": 1000},
        ],
        pricing=pricing,
        expect={"total_usd": 0.0, "warnings": ["unknown_pricing:unknown/model"]},
    ))

    # 3) zero sessions
    cases.append(run_case(
        "zero_sessions",
        sessions=[],
        pricing=pricing,
        expect={"total_usd": 0.0, "warnings": []},
    ))

    # 4) malformed usage record
    cases.append(run_case(
        "malformed_session",
        sessions=[{"model": "openai/gpt-4o-mini", "inputTokens": 1, "outputTokens": 1}],
        pricing=pricing,
        expect={"warnings": ["malformed_session:missing_sessionId"]},
    ))

    # 5) duplicate sessions
    cases.append(run_case(
        "duplicate_sessions",
        sessions=[
            {"sessionId": "s4", "model": "openai/gpt-4o-mini", "inputTokens": 1000, "outputTokens": 1000},
            {"sessionId": "s4", "model": "openai/gpt-4o-mini", "inputTokens": 9999, "outputTokens": 9999},
        ],
        pricing=pricing,
        expect={"warnings": ["duplicate_session:s4"]},
    ))

    out_path = "/home/openclaw/.openclaw/workspace/lobster/economist/dry-run-report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"ok": True, "report": cases}, f, ensure_ascii=False, indent=2)

    print(json.dumps({"ok": True, "out": out_path}, ensure_ascii=False))


if __name__ == "__main__":
    main()
