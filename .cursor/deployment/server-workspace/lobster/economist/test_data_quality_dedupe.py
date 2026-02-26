#!/usr/bin/env python3
"""Tests for dq incident dedupe (type+date_utc).

Case 1: two runs same day ratio>0.05 -> 1 emitted + 1 suppressed
Case 2: next day ratio>0.05 -> emitted again
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile


def write_jsonl(path: str, rows: list[dict]) -> None:
    with open(path, 'w', encoding='utf-8') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')


def run_postcheck(tmp: str, ts: str, ratio: float) -> dict:
    metrics_path = os.path.join(tmp, 'metrics.jsonl')
    incidents_path = os.path.join(tmp, 'incidents.jsonl')
    sessions_path = os.path.join(tmp, 'sessions.json')

    # sessions for sampling
    sessions = {f'k{i}': {"inputTokens": 1, "outputTokens": 1} for i in range(1, 6)}
    with open(sessions_path, 'w', encoding='utf-8') as f:
        json.dump(sessions, f)

    total = 100
    malformed = int(round(total * ratio))
    row = {
        'ts': ts,
        'computed_total_usd': 0,
        'unknown_pricing_count': 0,
        'total_sessions': total,
        'malformed_session_count': malformed,
        'duplicate_sessionid_artifact_count': 0,
        'planned_persist_count': 0,
        'planned_report_count': 0,
    }
    write_jsonl(metrics_path, [row])
    if not os.path.exists(incidents_path):
        write_jsonl(incidents_path, [])

    env = os.environ.copy()
    env['ECON_SOAK_METRICS'] = metrics_path
    env['ECON_SOAK_INCIDENTS'] = incidents_path
    env['ECON_SOAK_SESSIONS'] = sessions_path

    p = subprocess.run(
        ['python3', '/home/openclaw/.openclaw/workspace/lobster/economist/soak_post_check.py'],
        env=env,
        capture_output=True,
        text=True,
        timeout=20,
    )
    out = json.loads(p.stdout)['summary']
    inc_lines = open(incidents_path, 'r', encoding='utf-8').read().strip().splitlines()
    return {"out": out, "incident_lines": len([l for l in inc_lines if l.strip()])}


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        r1 = run_postcheck(tmp, '2026-02-26T00:00:00Z', 0.06)
        r2 = run_postcheck(tmp, '2026-02-26T01:00:00Z', 0.06)
        r3 = run_postcheck(tmp, '2026-02-27T00:00:00Z', 0.06)

        assert r1['out']['data_quality_signal'] == 'emitted'
        assert r2['out']['data_quality_signal'] == 'suppressed'
        assert r1['incident_lines'] == 1
        assert r2['incident_lines'] == 1  # still only one
        assert r3['out']['data_quality_signal'] == 'emitted'

        print(json.dumps({"ok": True, "checks": [
            {"case": "same_day_first", "signal": r1['out']['data_quality_signal']},
            {"case": "same_day_second", "signal": r2['out']['data_quality_signal']},
            {"case": "next_day", "signal": r3['out']['data_quality_signal']},
        ]}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
