#!/usr/bin/env python3
"""Lobster Git-sync runner (plan-only soak).

Goal: gather trustworthy metrics without performing destructive git actions.

Does:
- lock acquire with stale recovery (JSON lock)
- remote reachability (git ls-remote or fetch)
- fetch (non-destructive, but updates refs)
- compute ahead/behind, local dirty (whitelist-only)
- plan commit/push (but never execute)
- append metrics JSONL

Metrics JSONL fields per run:
- ts
- runs_total (=1)
- lock_acquired (0/1)
- stale_lock_recovered (0/1)
- no_op_runs (0/1)
- planned_commit (0/1)
- planned_push (0/1)
- rebase_conflicts (0/1)
- remote_unreachable (0/1)

Env:
- GIT_SYNC_REPO (default ~/Clowdbot)
- GIT_SYNC_LOCK (default ~/.openclaw/.runtime/git-sync.lock.json)
- GIT_SYNC_METRICS (default ~/.openclaw/.runtime/git-sync-lobster-metrics.jsonl)
"""

from __future__ import annotations

import json
import os
import subprocess
import time
from datetime import datetime, timezone

REPO = os.path.expanduser(os.environ.get("GIT_SYNC_REPO", "~/Clowdbot"))
LOCK_PATH = os.path.expanduser(os.environ.get("GIT_SYNC_LOCK", "~/.openclaw/.runtime/git-sync.lock.json"))
METRICS_PATH = os.path.expanduser(os.environ.get("GIT_SYNC_METRICS", "~/.openclaw/.runtime/git-sync-lobster-metrics.jsonl"))
TTL_S = int(os.environ.get("GIT_SYNC_LOCK_TTL_S", "1200"))

WHITELIST = {
    "data/cron-jobs.json",
    "data/cron-jobs-snapshot.json",
    "data/sent-digests.json",
    "data/dual-rating-data.json",
}


def sh(cmd: list[str], timeout: int = 25) -> tuple[int, str, str]:
    p = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout, p.stderr


def load_lock() -> dict | None:
    if not os.path.exists(LOCK_PATH):
        return None
    try:
        with open(LOCK_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def save_lock(obj: dict) -> None:
    os.makedirs(os.path.dirname(LOCK_PATH), exist_ok=True)
    tmp = LOCK_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, LOCK_PATH)


def acquire_lock(now: float) -> tuple[bool, bool]:
    """Returns (acquired, recovered)."""
    lock = load_lock()
    if lock:
        created = float(lock.get("created_at", 0) or 0)
        ttl = float(lock.get("ttl_seconds", TTL_S) or TTL_S)
        if created and (now - created) <= ttl:
            return False, False
        # stale -> recover
    recovered = bool(lock)
    obj = {"pid": os.getpid(), "created_at": now, "ttl_seconds": TTL_S, "run_id": f"{int(now)}"}
    save_lock(obj)
    return True, recovered


def release_lock() -> None:
    # best-effort
    try:
        if os.path.exists(LOCK_PATH):
            os.remove(LOCK_PATH)
    except Exception:
        pass


def status_whitelist_dirty() -> bool:
    rc, out, _ = sh(["git", "status", "--porcelain"], timeout=20)
    if rc != 0:
        return False
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        # format: XY path
        parts = line.split(maxsplit=1)
        if len(parts) != 2:
            continue
        path = parts[1]
        # normalize "?? " etc already removed
        if path in WHITELIST or any(path.endswith("/" + w) for w in WHITELIST):
            return True
    return False


def main() -> None:
    now = time.time()
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    lock_acquired, stale_recovered = acquire_lock(now)
    if not lock_acquired:
        rec = {
            "ts": ts,
            "runs_total": 1,
            "lock_acquired": 0,
            "stale_lock_recovered": 0,
            "no_op_runs": 1,
            "planned_commit": 0,
            "planned_push": 0,
            "rebase_conflicts": 0,
            "remote_unreachable": 0,
        }
        os.makedirs(os.path.dirname(METRICS_PATH), exist_ok=True)
        with open(METRICS_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        print(json.dumps({"ok": True, **rec}, ensure_ascii=False))
        return

    remote_unreachable = 0
    rebase_conflicts = 1 if os.path.exists(os.path.join(REPO, ".git", "rebase-merge")) or os.path.exists(os.path.join(REPO, ".git", "rebase-apply")) else 0

    # Remote reachable check (lightweight)
    rc, _, _ = sh(["git", "ls-remote", "origin", "HEAD"], timeout=25)
    if rc != 0:
        remote_unreachable = 1

    # Fetch to measure ahead/behind (still safe)
    if remote_unreachable == 0:
        rc, _, _ = sh(["git", "fetch", "origin", "main"], timeout=60)
        if rc != 0:
            remote_unreachable = 1

    # compute no-op / planned actions
    planned_commit = 1 if status_whitelist_dirty() else 0
    planned_push = 1 if planned_commit else 0
    no_op = 1 if (remote_unreachable == 0 and planned_commit == 0 and rebase_conflicts == 0) else 0

    rec = {
        "ts": ts,
        "runs_total": 1,
        "lock_acquired": 1,
        "stale_lock_recovered": 1 if stale_recovered else 0,
        "no_op_runs": no_op,
        "planned_commit": planned_commit,
        "planned_push": planned_push,
        "rebase_conflicts": rebase_conflicts,
        "remote_unreachable": remote_unreachable,
    }

    os.makedirs(os.path.dirname(METRICS_PATH), exist_ok=True)
    with open(METRICS_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    release_lock()
    print(json.dumps({"ok": True, **rec}, ensure_ascii=False))


if __name__ == "__main__":
    main()
