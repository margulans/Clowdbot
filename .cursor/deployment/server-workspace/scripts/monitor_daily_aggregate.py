#!/usr/bin/env python3
"""Daily aggregation for monitoring jobs.

Writes exactly ONE record per day into repo-tracked file:
  /home/openclaw/.openclaw/workspace/data/monitor-daily.jsonl

Goal: avoid git-dirty loops while still having long-term stats.

Data sources:
- incidents.jsonl (only deviations)
- cron jobs.json (for enabled schedules)
- runtime heartbeat (optional)

This script is idempotent per day: if a record for today already exists, it exits 0.
Timezone: Asia/Almaty.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ALMATY = timezone(timedelta(hours=5))

INCIDENTS = Path('/home/openclaw/.openclaw/workspace/data/incidents.jsonl')
OUT = Path('/home/openclaw/.openclaw/workspace/data/monitor-daily.jsonl')


def today_local() -> str:
    return datetime.now(timezone.utc).astimezone(ALMATY).date().isoformat()


def parse_jsonl_lines(path: Path):
    if not path.exists():
        return
    with path.open('r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except Exception:
                continue


def main() -> None:
    day = today_local()

    # idempotency: already written today?
    if OUT.exists():
        for obj in parse_jsonl_lines(OUT):
            if isinstance(obj, dict) and obj.get('date') == day:
                return

    since_utc = datetime.now(timezone.utc) - timedelta(days=1)

    counts = {
        'critical': 0,
        'warn': 0,
        'cron_error': 0,
        'cron_skip': 0,
        'gateway_down': 0,
        'config_drift': 0,
        'backup_triggered': 0,
        'model_replaced': 0,
    }

    for obj in parse_jsonl_lines(INCIDENTS):
        if not isinstance(obj, dict):
            continue
        ts = obj.get('ts')
        if isinstance(ts, str):
            try:
                dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            except Exception:
                dt = None
        else:
            dt = None
        if not dt or dt < since_utc:
            continue

        sev = obj.get('severity')
        if sev == 'critical':
            counts['critical'] += 1
        elif sev == 'warn':
            counts['warn'] += 1

        t = obj.get('type')
        if t in counts:
            counts[t] += 1

    record = {
        'ts': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'date': day,
        'window': '24h',
        'counts': counts,
        'note': 'Daily aggregated monitoring stats (incidents only; success heartbeats are out-of-repo).'
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('a', encoding='utf-8') as f:
        f.write(json.dumps(record, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
