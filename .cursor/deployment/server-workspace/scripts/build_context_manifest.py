#!/usr/bin/env python3
"""Build context manifest: what files are always-loaded and what cron/skills reference.

Outputs: docs/protocols/context-manifest.md

This is best-effort static analysis:
- Always-loaded: AGENTS/USER/MEMORY/HEARTBEAT/SOUL/TOOLS + memory/YYYY-MM-DD.md
- Cron jobs: scans ~/.openclaw/cron/jobs.json payload.message/text for absolute/relative file paths.
- Skills: scans skills/**/SKILL.md for read/open paths.

The goal is transparency + change control, not perfect completeness.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from datetime import datetime, timezone

WORKSPACE = Path('/home/openclaw/.openclaw/workspace')
CRON_JOBS = Path('/home/openclaw/.openclaw/cron/jobs.json')
OUT_MD = WORKSPACE / 'docs' / 'protocols' / 'context-manifest.md'

PROTECTED = [
    'AGENTS.md',
    'USER.md',
    'MEMORY.md',
    'HEARTBEAT.md',
    'SOUL.md',
    'TOOLS.md',
]

# Rough path extractor
PATH_RE = re.compile(
    r'(?P<path>'
    r'(?:/home/openclaw/[^\s"\)]+\.(?:md|json|jsonl|py|sh|mjs))'
    r'|(?:skills/[\w\-]+/[^\s"\)]+\.(?:md|json|jsonl|py|sh|mjs))'
    r'|(?:docs/[\w\-/]+\.(?:md))'
    r'|(?:data/[\w\-/]+\.(?:json|jsonl|md))'
    r')'
)


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def rel(p: str) -> str:
    if p.startswith(str(WORKSPACE) + '/'):
        return p.replace(str(WORKSPACE) + '/', '')
    return p


def scan_text(text: str) -> list[str]:
    return [m.group('path') for m in PATH_RE.finditer(text or '')]


def main() -> None:
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)

    jobs = []
    if CRON_JOBS.exists():
        raw = json.loads(CRON_JOBS.read_text(encoding='utf-8'))
        jobs = raw.get('jobs', [])

    job_refs: dict[str, set[str]] = {}
    for j in jobs:
        jid = j.get('id')
        name = j.get('name')
        payload = j.get('payload') or {}
        blob = ''
        if payload.get('kind') == 'agentTurn':
            blob = payload.get('message') or ''
        elif payload.get('kind') == 'systemEvent':
            blob = payload.get('text') or ''
        refs = {rel(p) for p in scan_text(blob)}
        # include explicit schedule/metadata pointers if present
        if refs:
            job_refs[f"{name} ({jid})"] = refs

    # Skills scan
    skill_refs: dict[str, set[str]] = {}
    for skill_md in (WORKSPACE / 'skills').glob('*/SKILL.md'):
        txt = skill_md.read_text(encoding='utf-8', errors='ignore')
        refs = {rel(p) for p in scan_text(txt)}
        if refs:
            skill_refs[skill_md.parent.name] = refs

    # Render
    lines: list[str] = []
    lines.append('# Context Manifest (main + cron)')
    lines.append('')
    lines.append(f'Обновлено: `{iso_now()}`')
    lines.append('')

    lines.append('## Always-loaded (main session)')
    lines.append('')
    for f in PROTECTED:
        lines.append(f'- `{f}` (protected)')
    lines.append('- `memory/YYYY-MM-DD.md` (today + yesterday)')
    lines.append('')

    lines.append('## Protected Context Files (change-control)')
    lines.append('')
    lines.append('Изменения в этих файлах допускаются только по явному разрешению Маргулана в чате: **"да, меняй"**.')
    lines.append('')

    lines.append('## Cron jobs → referenced files (best-effort)')
    lines.append('')
    if not job_refs:
        lines.append('_No file references detected in cron payload messages._')
    else:
        for k in sorted(job_refs):
            lines.append(f'### {k}')
            for p in sorted(job_refs[k]):
                lines.append(f'- `{p}`')
            lines.append('')

    lines.append('## Skills → referenced files (best-effort)')
    lines.append('')
    if not skill_refs:
        lines.append('_No file references detected in skills SKILL.md._')
    else:
        for k in sorted(skill_refs):
            lines.append(f'### skills/{k}')
            for p in sorted(skill_refs[k]):
                lines.append(f'- `{p}`')
            lines.append('')

    OUT_MD.write_text('\n'.join(lines).rstrip() + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
