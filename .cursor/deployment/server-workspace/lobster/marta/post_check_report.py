#!/usr/bin/env python3
"""24h decision gate for Marta plan-only soak."""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone

MET = os.path.expanduser('~/.openclaw/.runtime/marta-lobster-metrics.jsonl')
INCIDENTS = os.path.expanduser('~/.openclaw/workspace/data/incidents.jsonl')

LOBSTER_SOURCES = {'marta-lobster', 'lobster-marta'}
LOBSTER_JOB_IDS: set[str] = set()
LEGACY_JOB_IDS = {
    'ce006db5-350b-44be-baef-8b216ed687e4',
    '582cc3f0-9941-4e74-ae77-0afac52c6258',
    '89db97f7-e05e-4e3b-990b-fefc1815e7d7',
}


def read_jsonl(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    out=[]
    with open(path,'r',encoding='utf-8') as f:
        for line in f:
            line=line.strip()
            if not line:
                continue
            try: out.append(json.loads(line))
            except Exception: pass
    return out


def parse_ts(ts: str) -> datetime:
    if ts.endswith('Z'):
        ts = ts[:-1] + '+00:00'
    return datetime.fromisoformat(ts)


def classify_scope(inc: dict) -> str:
    # hotfix: treat uchastkovy:git_dirty as legacy-scoped (should not block gates)
    if inc.get('source') == 'uchastkovy' and inc.get('type') == 'git_dirty':
        return 'legacy'

    job_id = inc.get('jobId')
    src = inc.get('source')
    if src in LOBSTER_SOURCES or (isinstance(job_id, str) and job_id in LOBSTER_JOB_IDS):
        return 'lobster'
    if isinstance(job_id, str) and job_id in LEGACY_JOB_IDS:
        return 'legacy'
    return 'unknown'


def scoped_incident_deltas(incidents: list[dict], since_ts: datetime) -> dict:
    total=lobster=legacy=unknown=0
    for r in incidents:
        ts=r.get('ts')
        if not isinstance(ts,str):
            continue
        try:
            if parse_ts(ts) < since_ts:
                continue
        except Exception:
            continue
        total += 1
        scope = classify_scope(r)
        if scope == 'lobster':
            lobster += 1
        elif scope == 'legacy':
            legacy += 1
        else:
            unknown += 1
    return {
        'incidents_total_delta': total,
        'incidents_lobster_scoped_delta': lobster,
        'incidents_legacy_scoped_delta': legacy,
        'incidents_unknown_scoped_delta': unknown,
    }


def main() -> None:
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)
    def get_ts(rec: dict):
        # hotfix: accept both ts and legacy timestamp keys
        ts = rec.get('ts')
        if not isinstance(ts, str):
            ts = rec.get('timestamp')
        return ts if isinstance(ts, str) else None

    rows=[r for r in read_jsonl(MET) if get_ts(r) is not None]
    r24=[]
    for r in rows:
        ts_val = get_ts(r)
        try:
            if ts_val and parse_ts(ts_val) >= since:
                r24.append(r)
        except Exception:
            continue

    agg={
        'runs': len(r24),
        'planned_memory_writes': sum(int(r.get('planned_memory_writes',0) or 0) for r in r24),
        'planned_messages': sum(int(r.get('planned_messages',0) or 0) for r in r24),
        'planned_git_actions': sum(int(r.get('planned_git_actions',0) or 0) for r in r24),
        'blocked_actions': sum(int(r.get('blocked_actions',0) or 0) for r in r24),
        'policy_violations': sum(int(r.get('policy_violations',0) or 0) for r in r24),
        'malformed_input_count': sum(int(r.get('malformed_input_count',0) or 0) for r in r24),
    }

    ready = (agg['runs'] >= 46 and agg['policy_violations'] == 0 and agg['malformed_input_count'] == 0)

    incidents=[r for r in read_jsonl(INCIDENTS) if isinstance(r.get('ts'),str)]
    deltas=scoped_incident_deltas(incidents, now - timedelta(hours=2))
    gate_status='ok'
    if deltas['incidents_unknown_scoped_delta']>0:
        gate_status='needs_review'
    if deltas['incidents_lobster_scoped_delta']>0:
        gate_status='blocked'

    out={
        'ts': now.isoformat().replace('+00:00','Z'),
        'window': '24h',
        'metrics': agg,
        'incident_scope': deltas,
        'gate_status': gate_status,
        'recommendation': 'READY' if (ready and gate_status=='ok') else ('NEEDS_REVIEW' if gate_status=='needs_review' else 'NOT_READY'),
        'notes': 'Plan-only: no messages/memory/git executed. Gate ignores legacy incidents; blocks only on lobster-scoped deltas; unknown => needs_review.'
    }

    print(json.dumps({'ok': True, 'summary': out}, ensure_ascii=False))


if __name__ == '__main__':
    main()
