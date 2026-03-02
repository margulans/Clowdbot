#!/usr/bin/env python3
"""Lobster Участковый — REAL mode (controlled).

Design goals:
- Deterministic, rule-only monitoring.
- NO automated repairs (safe-auto disabled for cutover).
- Minimal context: only problems/diff-ish output.
- Writes lobster-scoped incidents for critical only.

Outputs:
- Incidents: ~/.openclaw/workspace/data/incidents.jsonl (append)
- Heartbeat: ~/.openclaw/runtime/monitor-heartbeat.jsonl

Critical signals to record (severity=critical):
- gateway_down (gateway not active)
- cron_error / cron_skip (only for jobs with lastStatus=error/skipped or consecutiveErrors>0)

Non-critical:
- git_dirty -> warn
- disk_warn -> warn
"""

from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timezone, timedelta

INCIDENTS = os.path.expanduser('~/.openclaw/workspace/data/incidents.jsonl')
HEARTBEAT = os.path.expanduser('~/.openclaw/runtime/monitor-heartbeat.jsonl')
SOURCE = 'uchastkovy-lobster'


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')


def sh(cmd: list[str], timeout: int = 15) -> tuple[int,str,str]:
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def append_jsonl(path: str, rec: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path,'a',encoding='utf-8') as f:
        f.write(json.dumps(rec, ensure_ascii=False) + '\n')


def parse_iso(ts: str):
    try:
        return datetime.fromisoformat(ts.replace('Z', '+00:00'))
    except Exception:
        return None


def auto_close_stale_incidents(*, now_ts: str, ttl_hours: int = 24) -> int:
    """Auto-close stale incidents whose jobId is not present in live cron jobs.

    Stale definition:
    - record has jobId
    - resolved is not True
    - jobId not in ~/.openclaw/cron/jobs.json

    Auto-close after TTL (default 24h) by appending:
    - a 'resolved' record with ref_id
    - an info record type=auto_closed_stale_jobid_ttl

    Returns number of auto-closures performed.
    """
    now_dt = parse_iso(now_ts) or datetime.now(timezone.utc)
    cutoff = now_dt - timedelta(hours=ttl_hours)

    # Load live job ids
    live_ids = set()
    try:
        with open(os.path.expanduser('~/.openclaw/cron/jobs.json'), 'r', encoding='utf-8') as f:
            jobs = json.load(f).get('jobs', [])
        for j in jobs:
            jid = j.get('id')
            if isinstance(jid, str):
                live_ids.add(jid)
    except Exception:
        return 0

    # Scan incidents (file is expected to be moderate; keep single pass)
    stale_candidates = []
    try:
        with open(INCIDENTS, 'r', encoding='utf-8') as f:
            for line in f:
                line=line.strip()
                if not line:
                    continue
                try:
                    r=json.loads(line)
                except Exception:
                    continue

                if r.get('type') == 'resolved':
                    continue

                jid = r.get('jobId')
                if not isinstance(jid, str) or not jid:
                    continue

                if jid in live_ids:
                    continue

                if r.get('resolved') is True:
                    continue

                ts = r.get('ts')
                if not isinstance(ts, str):
                    continue
                t = parse_iso(ts)
                if not t or t > cutoff:
                    continue

                # Use best-effort reference id
                ref = r.get('id') or r.get('ref_id') or f"{r.get('type','unknown')}:{jid}"
                stale_candidates.append((ts, jid, ref, r.get('type','unknown')))
    except Exception:
        return 0

    closed = 0
    for ts0, jid, ref, typ in stale_candidates:
        append_jsonl(INCIDENTS, {
            'ts': now_ts,
            'type': 'resolved',
            'source': SOURCE,
            'severity': 'info',
            'ref_id': ref,
            'msg': 'auto-closed stale incident (jobId missing in live cron) after TTL',
            'detail': {'jobId': jid, 'orig_ts': ts0, 'orig_type': typ, 'ttl_hours': ttl_hours},
        })
        append_jsonl(INCIDENTS, {
            'ts': now_ts,
            'type': 'auto_closed_stale_jobid_ttl',
            'source': SOURCE,
            'severity': 'info',
            'jobId': jid,
            'msg': 'auto-closed stale incident by TTL',
            'detail': {'ref_id': ref, 'orig_ts': ts0, 'orig_type': typ, 'ttl_hours': ttl_hours},
            'resolved': True,
        })
        closed += 1

    return closed


def main() -> None:
    ts = iso_now()
    # gateway status
    rc,out,err = sh(['systemctl','--user','is-active','openclaw-gateway'], timeout=10)
    gw_active = (rc==0 and out=='active')
    if not gw_active:
        append_jsonl(INCIDENTS, {
            'ts': ts,
            'type': 'gateway_down',
            'source': SOURCE,
            'severity': 'critical',
            'msg': f'openclaw-gateway is-active={out or rc}',
            'detail': {'stderr': err[:400]},
            'resolved': False,
        })

    # disk pct
    rc2,out2,err2 = sh(['bash','-lc','df -P / | tail -n 1 | awk "{print $5}"'], timeout=10)
    disk_pct = None
    try:
        disk_pct = int((out2 or '0').strip().rstrip('%'))
    except Exception:
        pass
    if disk_pct is not None and disk_pct >= 85:
        append_jsonl(INCIDENTS, {
            'ts': ts,
            'type': 'disk_warn',
            'source': SOURCE,
            'severity': 'warn',
            'msg': f'disk usage {disk_pct}%',
            'resolved': False,
        })

    # git dirty (repo)
    rc3,out3,_ = sh(['bash','-lc','cd ~/Clowdbot && git status --porcelain | head -n 20'], timeout=15)
    if rc3==0 and (out3.strip()!=''):
        append_jsonl(INCIDENTS, {
            'ts': ts,
            'type': 'git_dirty',
            'source': SOURCE,
            'severity': 'warn',
            'msg': 'Uncommitted changes (sample)',
            'detail': {'sample': out3.splitlines()[:20]},
            'resolved': False,
        })

    # cron problems (via OpenClaw tool over stdin not available here) -> best-effort via cached jobs.json
    # We read ~/.openclaw/cron/jobs.json as a snapshot of state (includes lastStatus/consecutiveErrors)
    problems=[]
    try:
        with open(os.path.expanduser('~/.openclaw/cron/jobs.json'),'r',encoding='utf-8') as f:
            data=json.load(f)
        for j in data.get('jobs',[]):
            st=(j.get('state') or {})
            if st.get('lastStatus') in ('error','skipped') or (st.get('consecutiveErrors') or 0) > 0:
                problems.append({
                    'id': j.get('id'),
                    'name': j.get('name'),
                    'lastStatus': st.get('lastStatus'),
                    'consecutiveErrors': st.get('consecutiveErrors'),
                    'lastRunAtMs': st.get('lastRunAtMs'),
                })
    except Exception:
        problems=[]

    for p in problems[:25]:
        append_jsonl(INCIDENTS, {
            'ts': ts,
            'type': 'cron_error' if p.get('lastStatus')=='error' or (p.get('consecutiveErrors') or 0)>0 else 'cron_skip',
            'source': SOURCE,
            'severity': 'critical',
            'jobId': p.get('id'),
            'job': p.get('name'),
            'msg': f"cron problem: lastStatus={p.get('lastStatus')} consecutiveErrors={p.get('consecutiveErrors')} lastRunAtMs={p.get('lastRunAtMs')}",
            'resolved': False,
        })

    # stale cleanup (TTL-based) — keep noise out of gates
    stale_closed = 0
    try:
        stale_closed = auto_close_stale_incidents(now_ts=ts, ttl_hours=24)
    except Exception:
        stale_closed = 0

    if gw_active and not problems:
        append_jsonl(HEARTBEAT, {'ts': ts,'type':'heartbeat','source':SOURCE,'status':'ok','window':'now'})

    print(json.dumps({'ok': True, 'ts': ts, 'gateway_active': gw_active, 'problems': len(problems), 'stale_closed': stale_closed}, ensure_ascii=False))


if __name__=='__main__':
    main()
