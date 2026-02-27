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
from datetime import datetime, timezone

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

    if gw_active and not problems:
        append_jsonl(HEARTBEAT, {'ts': ts,'type':'heartbeat','source':SOURCE,'status':'ok','window':'now'})

    print(json.dumps({'ok': True, 'ts': ts, 'gateway_active': gw_active, 'problems': len(problems)}, ensure_ascii=False))


if __name__=='__main__':
    main()
