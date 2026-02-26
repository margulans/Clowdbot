#!/usr/bin/env python3
"""Lobster Marta plan-only soak runner.

No side effects:
- NO message(action=send)
- NO writes to memory/*
- NO git commit/push

Only logs what actions would be planned.

Env:
- MARTA_MODE: aiganym_morning|aiganym_lunch|aiganym_evening|aiganym_report|smoke
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(os.path.expanduser('~/.openclaw/.runtime/marta-lobster-metrics.jsonl'))
ALLOWED = {'aiganym_morning','aiganym_lunch','aiganym_evening','aiganym_report','smoke'}


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')


def main() -> None:
    mode = os.environ.get('MARTA_MODE','smoke')
    malformed = 0
    if mode not in ALLOWED:
        malformed = 1
        mode = 'smoke'

    # Planning heuristics:
    # - check-in modes => planned message only
    # - report mode => planned message + planned memory read/write candidates + possible git action (after approval)
    planned_messages = 1
    planned_memory_writes = 1 if mode == 'aiganym_report' else 0
    planned_git_actions = 1 if mode == 'aiganym_report' else 0

    blocked_actions = 0
    policy_violations = 0

    rec = {
        'ts': iso_now(),
        'mode': mode,
        'runs_total': 1,
        'planned_memory_writes': planned_memory_writes,
        'planned_messages': planned_messages,
        'planned_git_actions': planned_git_actions,
        'blocked_actions': blocked_actions,
        'policy_violations': policy_violations,
        'malformed_input_count': malformed,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('a', encoding='utf-8') as f:
        f.write(json.dumps(rec, ensure_ascii=False) + '\n')

    print(json.dumps({'ok': True, **rec}, ensure_ascii=False))


if __name__ == '__main__':
    main()
