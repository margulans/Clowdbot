#!/usr/bin/env python3
"""Tests for economist_data_quality_degraded incident rule.

Case A: malformed_ratio=0.04 -> no incident
Case B: malformed_ratio=0.06 -> warn incident written
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


def run_case(tmp: str, ratio: float) -> dict:
    metrics_path = os.path.join(tmp, f'metrics_{ratio}.jsonl')
    incidents_path = os.path.join(tmp, f'incidents_{ratio}.jsonl')
    sessions_path = os.path.join(tmp, 'sessions.json')

    # sessions.json with 5 malformed examples (missing model) for sampling
    sessions = {f'k{i}': {"inputTokens": 1, "outputTokens": 1} for i in range(1, 6)}
    with open(sessions_path, 'w', encoding='utf-8') as f:
        json.dump(sessions, f)

    # single metrics row with total_sessions & malformed count consistent with ratio
    total = 100
    malformed = int(round(total * ratio))
    row = {
        'ts': '2026-02-26T00:00:00Z',
        'computed_total_usd': 0,
        'unknown_pricing_count': 0,
        'total_sessions': total,
        'malformed_session_count': malformed,
        'duplicate_sessionid_artifact_count': 0,
        'planned_persist_count': 0,
        'planned_report_count': 0,
    }
    write_jsonl(metrics_path, [row])
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
    out = json.loads(p.stdout)
    inc_lines = open(incidents_path, 'r', encoding='utf-8').read().strip().splitlines()
    return {
        'ratio': ratio,
        'recommendation': out['summary']['recommendation'],
        'data_quality_incident_written': out['summary'].get('data_quality_incident_written'),
        'incident_lines': len([l for l in inc_lines if l.strip()]),
    }


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        a = run_case(tmp, 0.04)
        b = run_case(tmp, 0.06)

        assert a['incident_lines'] == 0 and a['data_quality_incident_written'] is False
        assert b['incident_lines'] == 1 and b['data_quality_incident_written'] is True

        print(json.dumps({'ok': True, 'cases': [a, b]}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
