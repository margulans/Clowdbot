#!/usr/bin/env python3
"""Lobster Git sync — REAL mode (controlled cutover).

Goal: replace legacy git-sync cron with deterministic runner, with low-risk safeguards.

Safety constraints:
- No message() calls.
- No cron edits.
- Never force-push.
- If rebase conflict or push failure -> write a lobster-scoped critical incident and exit non-zero.

Actions (real sync):
1) git pull --rebase origin main
2) snapshot cron jobs: copy ~/.openclaw/cron/jobs.json -> repo data/cron-jobs.json (+ snapshot)
3) commit if dirty
4) push origin main

Metrics:
- Append one JSONL line to ~/.openclaw/.runtime/git-sync-lobster-metrics.jsonl (mode=real)

Notes:
- Uses a filesystem lock to avoid concurrent runs.
"""

from __future__ import annotations

import json
import os
import subprocess
import time
from datetime import datetime, timezone

REPO = os.path.expanduser('~/Clowdbot')
INCIDENTS = os.path.expanduser('~/.openclaw/workspace/data/incidents.jsonl')
METRICS = os.path.expanduser('~/.openclaw/.runtime/git-sync-lobster-metrics.jsonl')
LOCK = os.path.expanduser('~/.openclaw/.runtime/git-sync-lobster.lock')

CRON_JOBS_SRC = os.path.expanduser('~/.openclaw/cron/jobs.json')
CRON_JOBS_DST = os.path.join(REPO, '.cursor/deployment/server-workspace/data/cron-jobs.json')
CRON_JOBS_SNAP = os.path.join(REPO, '.cursor/deployment/server-workspace/data/cron-jobs-snapshot.json')

SOURCE = 'git-sync-lobster'


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')


def append_jsonl(path: str, rec: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'a', encoding='utf-8') as f:
        f.write(json.dumps(rec, ensure_ascii=False) + '\n')


def run(cmd: list[str], cwd: str | None = None, timeout: int = 300) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)


def lock_acquire() -> int:
    os.makedirs(os.path.dirname(LOCK), exist_ok=True)
    fd = os.open(LOCK, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        import fcntl
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except Exception:
        os.close(fd)
        raise
    return fd


def lock_release(fd: int) -> None:
    try:
        import fcntl
        fcntl.flock(fd, fcntl.LOCK_UN)
    finally:
        os.close(fd)


def copy_file(src: str, dst: str) -> None:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(src,'rb') as fsrc, open(dst,'wb') as fdst:
        fdst.write(fsrc.read())


def main() -> None:
    ts = iso_now()
    t0 = time.time()

    metrics = {
        'ts': ts,
        'mode': 'real',
        'runs_total': 1,
        'lock_acquired': 0,
        'stale_lock_recovered': 0,
        'no_op_runs': 0,
        'planned_commit': 0,
        'planned_push': 0,
        'rebase_conflicts': 0,
        'remote_unreachable': 0,
    }

    try:
        fd = lock_acquire()
        metrics['lock_acquired'] = 1
    except Exception as e:
        # lock busy -> treat as no-op
        metrics['no_op_runs'] = 1
        append_jsonl(METRICS, metrics)
        print(json.dumps({'ok': True, 'skipped': 'lock_busy', **metrics}, ensure_ascii=False))
        return

    try:
        # Precheck: if dirty tree, do NOT attempt pull --rebase (avoid cascade)
        st0 = run(['git','status','--porcelain'], cwd=REPO, timeout=60)
        dirty_lines = [ln for ln in (st0.stdout or '').splitlines() if ln.strip()]
        if dirty_lines:
            samples = []
            for ln in dirty_lines[:5]:
                parts = ln.split()
                # porcelain lines often end with path; best-effort
                samples.append(parts[-1] if parts else ln)
            append_jsonl(INCIDENTS, {
                'ts': ts,
                'type': 'git_sync_dirty_tree_blocked_pull',
                'source': SOURCE,
                'severity': 'warn',
                'msg': 'Dirty tree detected; skip git pull --rebase to avoid cascade',
                'detail': {
                    'dirty_files_count': len(dirty_lines),
                    'dirty_file_samples': samples,
                    'decision': 'skip_pull_due_to_dirty_tree',
                },
                'resolved': False,
            })
            metrics['no_op_runs'] = 1
            append_jsonl(METRICS, metrics)
            print(json.dumps({'ok': True, 'skipped': 'dirty_tree', **metrics}, ensure_ascii=False))
            return

        # Stage 1: pull --rebase
        p = run(['git','pull','--rebase','origin','main'], cwd=REPO, timeout=300)
        if p.returncode != 0:
            out = (p.stdout + '\n' + p.stderr).strip()[:1200]
            if 'CONFLICT' in out or 'Resolve all conflicts' in out or 'fix conflicts' in out.lower():
                metrics['rebase_conflicts'] = 1
            if 'Could not resolve host' in out or 'Network' in out:
                metrics['remote_unreachable'] = 1
            append_jsonl(INCIDENTS, {
                'ts': ts,
                'type': 'git_sync_pull_failed',
                'source': SOURCE,
                'severity': 'critical',
                'msg': 'git pull --rebase failed',
                'detail': {'out': out},
                'resolved': False,
            })
            append_jsonl(METRICS, metrics)
            raise SystemExit(2)

        # Stage 2: snapshot cron jobs
        if os.path.exists(CRON_JOBS_SRC):
            copy_file(CRON_JOBS_SRC, CRON_JOBS_DST)
            copy_file(CRON_JOBS_DST, CRON_JOBS_SNAP)

        # Stage 3: commit if dirty
        st = run(['git','status','--porcelain'], cwd=REPO, timeout=60)
        if st.returncode != 0:
            append_jsonl(INCIDENTS, {
                'ts': ts,
                'type': 'git_sync_status_failed',
                'source': SOURCE,
                'severity': 'critical',
                'msg': 'git status failed',
                'detail': {'stderr': st.stderr[:400]},
                'resolved': False,
            })
            append_jsonl(METRICS, metrics)
            raise SystemExit(2)

        if not st.stdout.strip():
            metrics['no_op_runs'] = 1
            append_jsonl(METRICS, metrics)
            print(json.dumps({'ok': True, 'no_op': True, **metrics}, ensure_ascii=False))
            return

        # Commit
        run(['git','add','-A'], cwd=REPO, timeout=120)
        msg = f"lobster git-sync: snapshot {ts}"
        c = run(['git','commit','-m', msg], cwd=REPO, timeout=120)
        if c.returncode != 0:
            out = (c.stdout + '\n' + c.stderr).strip()[:1200]
            # If nothing to commit, treat as no-op
            if 'nothing to commit' in out.lower():
                metrics['no_op_runs'] = 1
                append_jsonl(METRICS, metrics)
                print(json.dumps({'ok': True, 'no_op': True, **metrics}, ensure_ascii=False))
                return
            append_jsonl(INCIDENTS, {
                'ts': ts,
                'type': 'git_sync_commit_failed',
                'source': SOURCE,
                'severity': 'critical',
                'msg': 'git commit failed',
                'detail': {'out': out},
                'resolved': False,
            })
            append_jsonl(METRICS, metrics)
            raise SystemExit(2)
        metrics['planned_commit'] = 1

        # Push
        p2 = run(['git','push','origin','main'], cwd=REPO, timeout=180)
        if p2.returncode != 0:
            out = (p2.stdout + '\n' + p2.stderr).strip()[:1200]
            append_jsonl(INCIDENTS, {
                'ts': ts,
                'type': 'git_sync_push_failed',
                'source': SOURCE,
                'severity': 'critical',
                'msg': 'git push failed',
                'detail': {'out': out},
                'resolved': False,
            })
            append_jsonl(METRICS, metrics)
            raise SystemExit(2)
        metrics['planned_push'] = 1

        append_jsonl(METRICS, metrics)
        print(json.dumps({'ok': True, 'synced': True, 'duration_s': round(time.time()-t0,2), **metrics}, ensure_ascii=False))

    finally:
        try:
            lock_release(fd)
        except Exception:
            pass


if __name__ == '__main__':
    main()
