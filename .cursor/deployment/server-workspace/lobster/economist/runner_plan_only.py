#!/usr/bin/env python3
"""Deterministic Economist plan-only soak runner.

- Reads authoritative sessions registry: ~/.openclaw/agents/main/sessions/sessions.json
- Reads pricing: data/model-pricing.json
- Computes computed_total_usd deterministically (rule-first)
- Counts unknown pricing / malformed / duplicate session keys
- Appends one metrics record to ~/.openclaw/.runtime/economist-lobster-metrics.jsonl

No writes to economist-log.jsonl or cost-summary.json.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple

SESSIONS_JSON = Path('/home/openclaw/.openclaw/agents/main/sessions/sessions.json')
PRICING_JSON = Path('/home/openclaw/.openclaw/workspace/data/model-pricing.json')
METRICS_JSONL = Path(os.path.expanduser('~/.openclaw/.runtime/economist-lobster-metrics.jsonl'))


def iso_now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def load_json(path: Path) -> Any:
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def normalize_model(model: str) -> str:
    m = (model or '').strip()
    if m == 'gpt-4o-mini':
        return 'openai/gpt-4o-mini'
    if m == 'gpt-5.2':
        return 'openai/gpt-5.2'
    return m


def cost_for(model: str, in_tokens: int, out_tokens: int, pricing: Dict[str, Any]) -> Tuple[float, bool]:
    models = pricing.get('models', {})
    m = normalize_model(model)
    p = models.get(m) or models.get(model)
    if not p:
        return 0.0, False
    in_per_1m = float(p.get('input_per_1m', 0.0))
    out_per_1m = float(p.get('output_per_1m', 0.0))
    cost = (in_tokens * in_per_1m / 1_000_000.0) + (out_tokens * out_per_1m / 1_000_000.0)
    return cost, True


@dataclass
class Metrics:
    computed_total_usd: float = 0.0
    unknown_pricing_count: int = 0
    malformed_session_count: int = 0
    duplicate_session_count: int = 0
    planned_persist_count: int = 0
    planned_report_count: int = 0


def compute_metrics(sessions: Dict[str, Any], pricing: Dict[str, Any]) -> Metrics:
    seen_ids = set()
    m = Metrics()

    for key, s in sessions.items():
        # Prefer explicit sessionId if present; fallback to registry key.
        sid = None
        if isinstance(s, dict) and isinstance(s.get('sessionId'), str) and s.get('sessionId'):
            sid = s.get('sessionId')
        else:
            sid = key
        if not isinstance(s, dict):
            m.malformed_session_count += 1
            continue

        if sid in seen_ids:
            m.duplicate_session_count += 1
            continue
        seen_ids.add(sid)

        model_raw = s.get('model') or s.get('modelProvider')
        if not isinstance(model_raw, str) or not model_raw.strip():
            m.malformed_session_count += 1
            continue

        try:
            in_t = int(s.get('inputTokens') or 0)
            out_t = int(s.get('outputTokens') or 0)
        except Exception:
            m.malformed_session_count += 1
            continue

        c, ok = cost_for(model_raw, in_t, out_t, pricing)
        if not ok:
            m.unknown_pricing_count += 1
        m.computed_total_usd += c
        m.planned_persist_count += 1

    # stable rounding for reporting
    m.computed_total_usd = float(f"{m.computed_total_usd:.6f}")
    return m


def append_metrics(rec: dict) -> None:
    METRICS_JSONL.parent.mkdir(parents=True, exist_ok=True)
    with METRICS_JSONL.open('a', encoding='utf-8') as f:
        f.write(json.dumps(rec, ensure_ascii=False) + '\n')


def main() -> None:
    sessions = load_json(SESSIONS_JSON)
    pricing = load_json(PRICING_JSON)

    met = compute_metrics(sessions, pricing)

    rec = {
        'ts': iso_now_utc(),
        'runs_total': 1,
        'computed_total_usd': met.computed_total_usd,
        'unknown_pricing_count': met.unknown_pricing_count,
        'malformed_session_count': met.malformed_session_count,
        'duplicate_session_count': met.duplicate_session_count,
        'planned_persist_count': met.planned_persist_count,
        'planned_report_count': 0,
    }

    append_metrics(rec)
    print(json.dumps({'ok': True, **rec}, ensure_ascii=False))


if __name__ == '__main__':
    main()
