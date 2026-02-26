#!/usr/bin/env python3
"""Lobster Wendy plan-only soak runner.

Does NOT send messages and does NOT write user files.
It only simulates what Wendy *would* do and logs metrics.

Env:
- WENDY_MODE: morning-briefing|daily-reflection|weekly-insight|goal-check|smoke (default smoke)
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(os.path.expanduser('~/.openclaw/.runtime/wendy-lobster-metrics.jsonl'))

ALLOWED_MODES = {'morning-briefing','daily-reflection','weekly-insight','goal-check','smoke'}


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')


def main() -> None:
    mode = os.environ.get('WENDY_MODE','smoke')
    malformed = 0
    if mode not in ALLOWED_MODES:
        malformed = 1
        mode = 'smoke'

    # Planning rules (approval-heavy):
    # - planned_messages: Wendy would message user in all modes
    # - planned_user_writes: Wendy would write Briefing/Reflection logs in some modes
    planned_messages = 1
    planned_user_writes = 1 if mode in ('morning-briefing','daily-reflection','smoke') else 0

    blocked_actions = 0
    policy_violations = 0  # plan-only runner never sends/writes

    rec = {
        'ts': iso_now(),
        'mode': mode,
        'runs_total': 1,
        'planned_messages': planned_messages,
        'planned_user_writes': planned_user_writes,
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
