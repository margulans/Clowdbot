#!/usr/bin/env python3
"""Compute token/cost summary from OpenClaw sessions registry.

Why: the tool sessions_list is scoped and does not return all sessions, but
~/.openclaw/agents/main/sessions/sessions.json contains authoritative totals.

Outputs:
- /home/openclaw/.openclaw/workspace/data/cost-summary.json
- appends a compact run record to /home/openclaw/.openclaw/workspace/data/economist-log.jsonl
- appends gemini-cron snapshot to /home/openclaw/.openclaw/workspace/data/token-usage.jsonl

Notes:
- Pricing is taken from data/model-pricing.json. Unknown models are costed at $0 and listed.
- Periods are computed in Asia/Almaty (UTC+5) by local calendar date.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Tuple
import re

SESSIONS_JSON = Path('/home/openclaw/.openclaw/agents/main/sessions/sessions.json')
PRICING_JSON = Path('/home/openclaw/.openclaw/workspace/data/model-pricing.json')
COST_SUMMARY_JSON = Path('/home/openclaw/.openclaw/workspace/data/cost-summary.json')
ECON_LOG_JSONL = Path('/home/openclaw/.openclaw/workspace/data/economist-log.jsonl')
TOKEN_USAGE_JSONL = Path('/home/openclaw/.openclaw/workspace/data/token-usage.jsonl')
CRON_SNAPSHOT_JSON = Path('/home/openclaw/.openclaw/workspace/data/cron-jobs-snapshot.json')

ALMATY_TZ = timezone(timedelta(hours=5))


def iso_now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def local_date_str(dt_utc: datetime) -> str:
    return dt_utc.astimezone(ALMATY_TZ).date().isoformat()


def week_start_local(dt_utc: datetime) -> str:
    d = dt_utc.astimezone(ALMATY_TZ).date()
    # Monday = 0
    start = d - timedelta(days=d.weekday())
    return start.isoformat()


def month_start_local(dt_utc: datetime) -> str:
    d = dt_utc.astimezone(ALMATY_TZ).date()
    start = d.replace(day=1)
    return start.isoformat()


@dataclass
class Totals:
    in_tokens: int = 0
    out_tokens: int = 0
    cost_usd: float = 0.0

    def add(self, in_t: int, out_t: int, cost: float) -> None:
        self.in_tokens += int(in_t or 0)
        self.out_tokens += int(out_t or 0)
        self.cost_usd += float(cost or 0.0)


def load_json(path: Path) -> Any:
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def append_jsonl(path: Path, obj: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8') as f:
        f.write(json.dumps(obj, ensure_ascii=False) + '\n')


def normalize_model(model: str) -> str:
    # Normalize provider-prefixed names and common aliases
    m = (model or '').strip()
    if m in ('gpt-4o-mini',):
        return 'openai/gpt-4o-mini'
    if m in ('gpt-5.2',):
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


def main() -> None:
    now_utc = datetime.now(timezone.utc)
    today_local = local_date_str(now_utc)
    week_start = week_start_local(now_utc)
    month_start = month_start_local(now_utc)

    sessions: Dict[str, Any] = load_json(SESSIONS_JSON)
    pricing = load_json(PRICING_JSON)

    # Cron metadata for job/category breakdown
    cron_jobs = {}
    try:
        cron_jobs_raw = load_json(Path('/home/openclaw/.openclaw/cron/jobs.json'))
        for j in cron_jobs_raw.get('jobs', []):
            if isinstance(j, dict) and j.get('id'):
                cron_jobs[j['id']] = {
                    'name': j.get('name') or j['id'],
                    'model_config': (j.get('payload') or {}).get('model'),
                }
    except Exception:
        cron_jobs = {}

    def cron_category(job_name: str) -> str:
        n = (job_name or '').lower()
        if 'дайджест' in n and 'мнения' not in n:
            return 'digest_news'
        if 'мнения' in n:
            return 'digest_opinions'
        if 'участковый' in n:
            return 'monitoring_uchastkovy'
        if 'чекист' in n:
            return 'monitoring_chekist'
        if 'механик' in n:
            return 'monitoring_mekhanik'
        if 'экономист' in n:
            return 'economist'
        if 'git sync' in n or 'auto-commit' in n or 'auto-push' in n:
            return 'git_sync'
        if 'marta' in n or 'айганым' in n:
            return 'aiganym_marta'
        if 'weekly review' in n and 'memory' in n:
            return 'memory_review'
        if 'optimizer' in n or 'контекста' in n:
            return 'context_optimizer'
        if 'monitor daily summary' in n:
            return 'monitor_aggregate'
        return 'other'

    CRON_RUN_RE = re.compile(r'^agent:main:cron:([0-9a-f\-]{8,})(?::run:([0-9a-f\-]{8,}))?$')
    def parse_cron_key(key: str) -> Tuple[str | None, str | None]:
        m = CRON_RUN_RE.match(key or '')
        if not m:
            return None, None
        return m.group(1), m.group(2)


    # Compute period windows in local calendar terms.
    # We include sessions whose updatedAt falls on/after the start date in local time.
    def in_period(updated_at_ms: int, start_local_date: str) -> bool:
        if not updated_at_ms:
            return False
        dt = datetime.fromtimestamp(updated_at_ms / 1000.0, tz=timezone.utc)
        return local_date_str(dt) >= start_local_date

    totals_day = Totals()
    totals_week = Totals()
    totals_month = Totals()
    by_model: Dict[str, Totals] = {}

    # Rolling windows
    totals_last24h = Totals()
    by_model_last24h: Dict[str, Totals] = {}

    # Cron breakdown (rolling 24h) — only :run: sessions for accuracy
    by_cron_job_last24h: Dict[str, Totals] = {}
    by_cron_category_last24h: Dict[str, Totals] = {}

    unknown_models = set()

    last24h_cut = now_utc - timedelta(hours=24)

    # Gemini-cron snapshot (tokens only)
    gemini_cron_ids = set()
    if CRON_SNAPSHOT_JSON.exists():
        try:
            cron_snap = load_json(CRON_SNAPSHOT_JSON)
            for j in cron_snap.get('jobs', []):
                if not isinstance(j, dict):
                    continue
                if j.get('sessionTarget') != 'isolated':
                    continue
                payload = j.get('payload') or {}
                m = payload.get('model')
                if isinstance(m, str) and m.startswith('google/gemini'):
                    gemini_cron_ids.add(j.get('id'))
        except Exception:
            gemini_cron_ids = set()

    gemini_cron_in = 0
    gemini_cron_out = 0
    gemini_cron_sessions = 0

    for key, s in sessions.items():
        if not isinstance(s, dict):
            continue

        updated_at = int(s.get('updatedAt') or 0)
        if not updated_at:
            continue
        dt_utc = datetime.fromtimestamp(updated_at / 1000.0, tz=timezone.utc)

        model_raw = s.get('model') or s.get('modelProvider')
        if not isinstance(model_raw, str):
            continue
        model = normalize_model(model_raw)

        in_t = int(s.get('inputTokens') or 0)
        out_t = int(s.get('outputTokens') or 0)

        # Rolling 24h
        if dt_utc >= last24h_cut:
            c, ok = cost_for(model, in_t, out_t, pricing)
            totals_last24h.add(in_t, out_t, c)
            bm = by_model_last24h.setdefault(model, Totals())
            bm.add(in_t, out_t, c)
            if not ok:
                unknown_models.add(model_raw)

            job_id, run_id = parse_cron_key(key)
            if job_id and run_id:
                meta = cron_jobs.get(job_id, {})
                name = meta.get('name') or job_id
                cat = cron_category(name)
                bj = by_cron_job_last24h.setdefault(job_id, Totals())
                bj.add(in_t, out_t, c)
                bc = by_cron_category_last24h.setdefault(cat, Totals())
                bc.add(in_t, out_t, c)

        # Period inclusion (calendar)
        if in_period(updated_at, today_local):
            c, ok = cost_for(model, in_t, out_t, pricing)
            totals_day.add(in_t, out_t, c)
            if not ok:
                unknown_models.add(model_raw)

        if in_period(updated_at, week_start):
            c, ok = cost_for(model, in_t, out_t, pricing)
            totals_week.add(in_t, out_t, c)
            if not ok:
                unknown_models.add(model_raw)

        if in_period(updated_at, month_start):
            c, ok = cost_for(model, in_t, out_t, pricing)
            totals_month.add(in_t, out_t, c)
            if not ok:
                unknown_models.add(model_raw)

            bm = by_model.setdefault(model, Totals())
            bm.add(in_t, out_t, c)

        # Gemini cron snapshot (tokens only)
        if gemini_cron_ids and key.startswith('agent:main:cron:'):
            parts = key.split(':')
            if len(parts) >= 4:
                job_id = parts[3]
                if job_id in gemini_cron_ids:
                    gemini_cron_in += in_t
                    gemini_cron_out += out_t
                    gemini_cron_sessions += 1

    summary = {
        '_comment': 'Текущий агрегат затрат. Обновляется Экономистом ежедневно. Читается для мгновенных ответов.',
        'last_updated': iso_now_utc(),
        'last_session_scan_at': iso_now_utc(),
        'period': {
            'last24h': {
                'window': 'rolling_24h',
                'from_utc': last24h_cut.replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
                'to_utc': now_utc.replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
                'cost_usd': round(totals_last24h.cost_usd, 10),
                'tokens_input': totals_last24h.in_tokens,
                'tokens_output': totals_last24h.out_tokens,
            },
            'day': {
                'date': today_local,
                'cost_usd': round(totals_day.cost_usd, 10),
                'tokens_input': totals_day.in_tokens,
                'tokens_output': totals_day.out_tokens,
            },
            'week': {
                'start': week_start,
                'cost_usd': round(totals_week.cost_usd, 10),
                'tokens_input': totals_week.in_tokens,
                'tokens_output': totals_week.out_tokens,
            },
            'month': {
                'start': month_start,
                'cost_usd': round(totals_month.cost_usd, 10),
                'tokens_input': totals_month.in_tokens,
                'tokens_output': totals_month.out_tokens,
            },
        },
        'by_model': {
            m: {
                'cost_usd': round(t.cost_usd, 10),
                'tokens_input': t.in_tokens,
                'tokens_output': t.out_tokens,
            }
            for m, t in sorted(by_model.items(), key=lambda kv: kv[0])
        },
        'by_model_last24h': {
            m: {
                'cost_usd': round(t.cost_usd, 10),
                'tokens_input': t.in_tokens,
                'tokens_output': t.out_tokens,
            }
            for m, t in sorted(by_model_last24h.items(), key=lambda kv: kv[0])
        },
        'by_cron_job_last24h': {
            jid: {
                'name': (cron_jobs.get(jid, {}) or {}).get('name') or jid,
                'cost_usd': round(t.cost_usd, 10),
                'tokens_input': t.in_tokens,
                'tokens_output': t.out_tokens,
            }
            for jid, t in sorted(by_cron_job_last24h.items(), key=lambda kv: kv[0])
        },
        'by_cron_category_last24h': {
            cat: {
                'cost_usd': round(t.cost_usd, 10),
                'tokens_input': t.in_tokens,
                'tokens_output': t.out_tokens,
            }
            for cat, t in sorted(by_cron_category_last24h.items(), key=lambda kv: kv[0])
        },
        'external_fixed': {
            'hetzner_vps': 5.5,
        },
        # kept for backward compatibility with older logic
        'processed_session_ids': [],
        'unknown_pricing_models': sorted(set(unknown_models)),
        'source': 'sessions.json',
    }

    COST_SUMMARY_JSON.parent.mkdir(parents=True, exist_ok=True)
    COST_SUMMARY_JSON.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    append_jsonl(ECON_LOG_JSONL, {
        'ts': iso_now_utc(),
        'type': 'daily-collect',
        'source': 'sessions.json',
        'last24h': summary['period']['last24h'],
        'day': summary['period']['day'],
        'week': summary['period']['week'],
        'month': summary['period']['month'],
        'unknown_pricing_models': summary['unknown_pricing_models'],
        'by_cron_category_last24h': summary['by_cron_category_last24h'],
    })

    append_jsonl(TOKEN_USAGE_JSONL, {
        'ts': iso_now_utc(),
        'type': 'gemini_cron_snapshot',
        'input_tokens': gemini_cron_in,
        'output_tokens': gemini_cron_out,
        'sessions': gemini_cron_sessions,
    })


if __name__ == '__main__':
    main()
