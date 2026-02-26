#!/usr/bin/env python3
"""24h decision gate for Marta plan-only soak."""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone

MET = os.path.expanduser('~/.openclaw/.runtime/marta-lobster-metrics.jsonl')


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


def main() -> None:
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)
    rows=[r for r in read_jsonl(MET) if isinstance(r.get('ts'),str)]
    r24=[]
    for r in rows:
        try:
            if parse_ts(r['ts']) >= since:
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

    out={
        'ts': now.isoformat().replace('+00:00','Z'),
        'window': '24h',
        'metrics': agg,
        'recommendation': 'READY' if ready else 'NOT_READY',
        'notes': 'Plan-only: no messages sent, no memory writes, no git actions executed.'
    }

    print(json.dumps({'ok': True, 'summary': out}, ensure_ascii=False))


if __name__ == '__main__':
    main()
