#!/usr/bin/env python3
"""Dry-run harness for Lobster Git-sync pipeline.

Simulates:
precheck+lock -> pull --rebase -> snapshot(write) -> stage+commit -> push -> emit audit

Also simulates lock recovery and anti-loop (commit whitelist).
"""

from __future__ import annotations

import json
import time
import hashlib


def run_id(seed: str) -> str:
    return hashlib.sha1(seed.encode()).hexdigest()[:10]


class Lock:
    def __init__(self, ttl_s: int = 1200):
        self.ttl_s = ttl_s
        self.meta: dict | None = None

    def acquire(self, now: float, pid: int, rid: str):
        if self.meta is None:
            self.meta = {"pid": pid, "created_at": now, "ttl_seconds": self.ttl_s, "run_id": rid}
            return {"acquired": True, "recovered": False}
        # stale check
        if now - float(self.meta["created_at"]) > self.ttl_s:
            old = self.meta
            self.meta = {"pid": pid, "created_at": now, "ttl_seconds": self.ttl_s, "run_id": rid}
            return {"acquired": True, "recovered": True, "old": old}
        return {"acquired": False, "recovered": False}

    def release(self):
        self.meta = None


def pipeline(case: dict, lock: Lock, now: float) -> dict:
    rid = run_id(case["name"] + str(now))
    incidents = []
    actions = []

    # precheck+lock
    lock_res = lock.acquire(now, pid=12345, rid=rid)
    if not lock_res["acquired"]:
        return {"incidents": [{"type": "git_sync_locked", "severity": "warn"}], "actions": []}
    if lock_res.get("recovered"):
        incidents.append({"type": "git_sync_stale_lock", "severity": "warn", "msg": "stale lock recovered"})

    # pull --rebase
    actions.append({"kind": "git_pull_rebase", "dry_run_disabled": False, "approval_required": False})
    if case.get("network_fail"):
        incidents.append({"type": "git_remote_unreachable", "severity": "critical", "msg": "ls-remote/push failed"})
        actions.append({"kind": "message_alert", "dry_run_disabled": True, "approval_required": False})
        lock.release()
        return {"incidents": incidents, "actions": actions}

    if case.get("rebase_conflict"):
        incidents.append({"type": "git_rebase_conflict", "severity": "critical", "msg": "rebase conflict; aborted"})
        actions.append({"kind": "git_rebase_abort", "dry_run_disabled": False, "approval_required": False})
        actions.append({"kind": "message_alert", "dry_run_disabled": True, "approval_required": False})
        lock.release()
        return {"incidents": incidents, "actions": actions}

    # snapshot(write)
    actions.append({"kind": "snapshot_write", "dry_run_disabled": False, "approval_required": False})

    # stage+commit (only if diff and only if whitelisted)
    diff_paths = case.get("diff_paths", [])
    whitelisted = all(p in case.get("whitelist", []) for p in diff_paths)
    if not diff_paths:
        # no-op
        actions.append({"kind": "emit_audit", "dry_run_disabled": False, "approval_required": False, "result": "noop"})
        lock.release()
        return {"incidents": incidents, "actions": actions}

    if not whitelisted:
        incidents.append({"type": "git_sync_nonwhitelist_diff", "severity": "critical", "msg": "diff includes non-whitelisted paths"})
        actions.append({"kind": "message_alert", "dry_run_disabled": True, "approval_required": False})
        lock.release()
        return {"incidents": incidents, "actions": actions}

    actions.append({"kind": "git_commit", "dry_run_disabled": True, "approval_required": True})
    actions.append({"kind": "git_push", "dry_run_disabled": True, "approval_required": True})
    actions.append({"kind": "emit_audit", "dry_run_disabled": False, "approval_required": False, "result": "would_commit_push"})

    lock.release()
    return {"incidents": incidents, "actions": actions}


def main() -> None:
    whitelist = [
        "data/cron-jobs.json",
        "data/cron-jobs-snapshot.json",
        "data/sent-digests.json",
        "data/dual-rating-data.json",
    ]

    lock = Lock(ttl_s=1200)
    t0 = time.time()

    cases = [
        {"name": "no_changes", "diff_paths": [], "whitelist": whitelist},
        {"name": "snapshot_diff_commit_push", "diff_paths": ["data/cron-jobs.json"], "whitelist": whitelist},
        {"name": "remote_ahead_rebase_ok", "diff_paths": ["data/cron-jobs.json"], "whitelist": whitelist},
        {"name": "rebase_conflict", "rebase_conflict": True, "diff_paths": [], "whitelist": whitelist},
        {"name": "network_fail", "network_fail": True, "diff_paths": [], "whitelist": whitelist},
    ]

    report = []
    expected = {
        "no_changes": {"inc": [], "has": ["emit_audit"], "result": "noop"},
        "snapshot_diff_commit_push": {"inc": [], "has": ["git_commit", "git_push"], "result": "would_commit_push"},
        "remote_ahead_rebase_ok": {"inc": [], "has": ["git_pull_rebase", "git_commit", "git_push"], "result": "would_commit_push"},
        "rebase_conflict": {"inc": ["git_rebase_conflict"], "has": ["git_rebase_abort", "message_alert"]},
        "network_fail": {"inc": ["git_remote_unreachable"], "has": ["message_alert"]},
    }

    for i, c in enumerate(cases):
        now = t0 + i * 60
        actual = pipeline(c, lock, now)
        report.append({
            "name": c["name"],
            "expected": expected[c["name"]],
            "actual": actual,
        })

    print(json.dumps({"ok": True, "report": report}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
