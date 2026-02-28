#!/usr/bin/env python3
"""Lobster Чекист — REAL mode (controlled cutover).

Constraints:
- NO message() calls.
- NO cron updates/restarts.
- Reads limited window (last 4h) to minimize context.
- If new lobster-scoped critical signals exist, appends ONE lobster-scoped critical incident marker.
- Always appends metrics to ~/.openclaw/.runtime/chekist-lobster-metrics.jsonl with mode="real".

Files:
- incidents: ~/.openclaw/workspace/data/incidents.jsonl
- metrics:  ~/.openclaw/.runtime/chekist-lobster-metrics.jsonl
- heartbeat: ~/.openclaw/runtime/monitor-heartbeat.jsonl
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone

INCIDENTS = os.path.expanduser('~/.openclaw/workspace/data/incidents.jsonl')
METRICS = os.path.expanduser('~/.openclaw/.runtime/chekist-lobster-metrics.jsonl')
HEARTBEAT = os.path.expanduser('~/.openclaw/runtime/monitor-heartbeat.jsonl')
CRITICAL_SIGNALS = os.path.expanduser('~/.openclaw/.runtime/chekist-critical-signals.jsonl')
SOURCE = 'chekist-lobster'

# Keep the observability file bounded
CRITICAL_SIGNALS_MAX_LINES = 5000

CRITICAL_TYPES = {
  'cron_error',
  'config_drift',
  'gateway_down',
  'announce_queue_loop',
  'gateway_memory_high',
  'message_transport_failed',
}


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')


def parse_ts(ts: str) -> float:
    if ts.endswith('Z'):
        ts = ts[:-1] + '+00:00'
    return datetime.fromisoformat(ts).timestamp()


def read_recent_jsonl(path: str, tail_n: int = 6000, window_h: int = 4) -> list[dict]:
    if not os.path.exists(path):
        return []
    now = time.time()
    since = now - window_h*3600

    # tail-ish read
    try:
        with open(path, 'rb') as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            read_size = min(size, 2_000_000)
            f.seek(size - read_size)
            chunk = f.read().decode('utf-8', errors='ignore')
        lines = [ln for ln in chunk.splitlines() if ln.strip()][-tail_n:]
    except Exception:
        with open(path, 'r', encoding='utf-8') as f:
            lines = [ln.strip() for ln in f if ln.strip()][-tail_n:]

    out=[]
    for ln in lines:
        try:
            r=json.loads(ln)
        except Exception:
            continue
        ts=r.get('ts')
        if not isinstance(ts,str):
            continue
        try:
            if parse_ts(ts) >= since:
                out.append(r)
        except Exception:
            continue
    return out


def active_critical(events: list[dict]) -> list[dict]:
    # basic resolved filtering
    resolved = {e.get('ref_id') for e in events if e.get('type')=='resolved' and isinstance(e.get('ref_id'),str)}
    out=[]
    for e in events:
        if e.get('type')=='resolved':
            continue
        if e.get('resolved') is True:
            continue
        if isinstance(e.get('id'),str) and e['id'] in resolved:
            continue
        if e.get('severity')=='critical' or e.get('type') in CRITICAL_TYPES:
            out.append(e)
    return out


def append_jsonl(path: str, rec: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'a', encoding='utf-8') as f:
        f.write(json.dumps(rec, ensure_ascii=False) + '\n')


def append_jsonl_bounded(path: str, recs: list[dict], max_lines: int) -> None:
    """Append records to a JSONL file and keep only the last max_lines lines."""
    if not recs:
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    existing: list[str] = []
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                existing = [ln.rstrip('\n') for ln in f if ln.strip()]
        except Exception:
            existing = []

    new_lines = [json.dumps(r, ensure_ascii=False) for r in recs]
    merged = (existing + new_lines)[-max_lines:]

    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write('\n'.join(merged) + ('\n' if merged else ''))
    os.replace(tmp, path)


def classify_scope(e: dict) -> str:
    src = str(e.get('source') or '')
    if src in ('git-sync-lobster', 'lobster-git-sync'):
        return 'lobster-git-sync'
    if 'lobster' in src:
        return 'unknown'
    if src:
        return 'legacy'
    return 'unknown'


def main() -> None:
    ts = iso_now()
    window_start_ts = datetime.fromtimestamp(time.time() - 4 * 3600, timezone.utc).isoformat().replace('+00:00', 'Z')

    events = read_recent_jsonl(INCIDENTS, window_h=4)
    crit = active_critical(events)

    # Observability: write full list of detected signal keys
    dedup_keys: set[tuple[str, str, str]] = set()
    signal_recs: list[dict] = []
    for e in crit:
        ets = e.get('ts') if isinstance(e.get('ts'), str) else ts
        job_id = e.get('jobId') if isinstance(e.get('jobId'), str) else None
        typ = str(e.get('type') or 'unknown_type')
        key = (ets, job_id or '', typ)
        if key in dedup_keys:
            continue
        dedup_keys.add(key)
        signal_recs.append({
            'ts': ets,
            'window_start_ts': window_start_ts,
            'jobId': job_id,
            'type': typ,
            'severity': e.get('severity') or ('critical' if typ in CRITICAL_TYPES else None),
            'source': e.get('source'),
            'scope': classify_scope(e),
        })

    # Ensure file exists even if no signals in this run
    os.makedirs(os.path.dirname(CRITICAL_SIGNALS), exist_ok=True)
    if not os.path.exists(CRITICAL_SIGNALS):
        open(CRITICAL_SIGNALS, 'a', encoding='utf-8').close()

    append_jsonl_bounded(CRITICAL_SIGNALS, signal_recs, CRITICAL_SIGNALS_MAX_LINES)

    # In controlled cutover, we only emit ONE marker if there is any active critical.
    if crit:
        marker={
            'ts': ts,
            'type': 'chekist_lobster_real_detected_critical',
            'source': SOURCE,
            'severity': 'critical',
            'msg': f'Detected {len(crit)} active critical signals in last 4h (no notifications sent).',
            'detail': {
                'sample': [
                    {
                        'type': c.get('type'),
                        'source': c.get('source'),
                        'jobId': c.get('jobId'),
                        'id': c.get('id'),
                    } for c in crit[:5]
                ]
            },
            'resolved': False,
        }
        append_jsonl(INCIDENTS, marker)
    else:
        append_jsonl(HEARTBEAT, {'ts': ts, 'type':'heartbeat', 'source': SOURCE, 'status':'ok', 'window':'4h-empty'})

    metrics={
        'ts': ts,
        'mode': 'real',
        'runs_total': 1,
        'active_critical_count': len(crit),
        'signals_written': len(signal_recs),
        'state_write_failed': 0,
        'message_events_total': 0,
    }
    append_jsonl(METRICS, metrics)
    print(json.dumps({'ok': True, **metrics}, ensure_ascii=False))


if __name__=='__main__':
    main()
