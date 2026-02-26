#!/usr/bin/env python3
"""3 deterministic test cases for economist computed_total_usd.

Cases:
- normal
- unknown_pricing
- duplicate_session
Also checks identical output for identical input.
"""

from __future__ import annotations

import copy
import json

from runner_plan_only import compute_metrics


def run_case(name: str, sessions: dict, pricing: dict):
    m1 = compute_metrics(copy.deepcopy(sessions), copy.deepcopy(pricing))
    m2 = compute_metrics(copy.deepcopy(sessions), copy.deepcopy(pricing))
    assert m1 == m2, f"non-deterministic: {name} {m1} != {m2}"
    return {"name": name, "metrics": m1.__dict__}


def main() -> None:
    pricing = {
        "models": {
            "openai/gpt-4o-mini": {"input_per_1m": 0.15, "output_per_1m": 0.6},
        }
    }

    normal_sessions = {
        "s1": {"model": "openai/gpt-4o-mini", "inputTokens": 1000000, "outputTokens": 0},
    }
    unknown_sessions = {
        "s2": {"model": "unknown/model", "inputTokens": 1000000, "outputTokens": 0},
    }
    dup_sessions = {
        "k1": {"sessionId": "dup", "model": "openai/gpt-4o-mini", "inputTokens": 1000000, "outputTokens": 0},
        "k2": {"sessionId": "dup", "model": "openai/gpt-4o-mini", "inputTokens": 2000000, "outputTokens": 0},
    }

    out = {
        "ok": True,
        "cases": [
            run_case("normal", normal_sessions, pricing),
            run_case("unknown_pricing", unknown_sessions, pricing),
            run_case("duplicate_session", dup_sessions, pricing),
        ],
    }

    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
