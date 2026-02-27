#!/usr/bin/env python3
"""Validate that user-requested reminder jobs are agentTurn + explicit Telegram message send.

Checks snapshot file:
  .cursor/deployment/server-workspace/data/cron-jobs.json

Fail conditions (for reminder-like jobs):
- sessionTarget != "isolated"
- payload.kind != "agentTurn"
- payload.message missing explicit message(action=send, channel=telegram, to=685668909, ...)

Reminder-like job heuristic:
- name contains "Reminder" OR startswith "🔔" OR contains "напомин"

Exit code 1 on any violation.
"""

from __future__ import annotations

import json
import os
import re
import sys
from typing import Any


def is_reminder(name: str) -> bool:
    """Heuristic: only *explicit* reminder jobs we create by protocol.

    We intentionally avoid catching legacy systemEvent reminders (e.g. meds) that may exist.
    """
    n = name.lower().strip()
    return (
        n.startswith("🔔")
        or n.startswith("reminder")
        or "reminder:" in n
    )


REQUIRED_SNIPPET_RE = re.compile(
    r"message\(action=send,\s*channel=telegram,\s*to=685668909,\s*message=\"",
    re.MULTILINE,
)


def fail(msg: str) -> None:
    print(msg)
    raise SystemExit(1)


def main() -> None:
    path = os.path.expanduser(
        "~/Clowdbot/.cursor/deployment/server-workspace/data/cron-jobs.json"
    )
    if not os.path.exists(path):
        fail(f"ERROR: cron snapshot not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        obj = json.load(f)

    jobs = obj.get("jobs")
    if not isinstance(jobs, list):
        fail("ERROR: cron snapshot has no jobs[]")

    violations: list[str] = []

    for j in jobs:
        if not isinstance(j, dict):
            continue
        name = str(j.get("name", ""))
        if not name or not is_reminder(name):
            continue

        sid = str(j.get("id", ""))
        session_target = j.get("sessionTarget")
        payload = j.get("payload") or {}
        pkind = payload.get("kind")

        if session_target != "isolated":
            violations.append(f"{sid} {name}: sessionTarget must be isolated (got {session_target})")
            continue
        if pkind != "agentTurn":
            violations.append(f"{sid} {name}: payload.kind must be agentTurn (got {pkind})")
            continue

        message = payload.get("message")
        if not isinstance(message, str):
            violations.append(f"{sid} {name}: payload.message missing")
            continue

        if not REQUIRED_SNIPPET_RE.search(message):
            violations.append(
                f"{sid} {name}: payload.message must contain explicit Telegram send: "
                "message(action=send, channel=telegram, to=685668909, message=\"...\")"
            )

    if violations:
        print("Reminder protocol violations:")
        for v in violations:
            print("-", v)
        raise SystemExit(1)

    print("OK: reminder protocol validated")


if __name__ == "__main__":
    main()
