#!/usr/bin/env python3
"""Soak monitoring probe for Mem0 memory contour.

Writes one JSONL record per run:
  {ts, capture_failed_count, qdrant_400_count, p95_latency_ms}

Sources:
- openclaw-gateway systemd journal (capture failed / Bad Request)
- openclaw-gateway journal for qdrant /points/search 400 (fallback when docker logs not accessible)

Notes:
- p95_latency_ms is best-effort. If no reliable signal is found, it is null.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from statistics import quantiles

OUT_PATH = os.environ.get(
    "MEM0_SOAK_OUT",
    os.path.expanduser("~/.openclaw/.runtime/mem0-soak.jsonl"),
)

WINDOW_MIN = int(os.environ.get("MEM0_SOAK_WINDOW_MIN", "10"))
UNIT = os.environ.get("MEM0_SOAK_UNIT", "openclaw-gateway")

CAPTURE_PATTERNS = [
    re.compile(r"capture failed", re.I),
    re.compile(r"Bad Request", re.I),
]

QDRANT_400_PATTERNS = [
    re.compile(r"/points/search", re.I),
    re.compile(r"\b400\b"),
]

# Heuristic latency extraction patterns (may not exist depending on build)
LAT_PATTERNS = [
    re.compile(r"first[_-]?response[_-]?ms[=: ]+(\d+)", re.I),
    re.compile(r"first[_-]?token[_-]?ms[=: ]+(\d+)", re.I),
    re.compile(r"p95[_-]?latency[_-]?ms[=: ]+(\d+)", re.I),
    re.compile(r"latency[_-]?ms[=: ]+(\d+)", re.I),
]


def journal_lines(since_iso: str) -> list[str]:
    # --no-pager + short format to keep it stable.
    cmd = [
        "journalctl",
        "--user",
        "-u",
        UNIT,
        "--since",
        since_iso,
        "--no-pager",
        "-o",
        "short-iso",
    ]
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True)
    except subprocess.CalledProcessError as e:
        out = e.output or ""
    return out.splitlines()


def count_matches(lines: list[str], patterns: list[re.Pattern]) -> int:
    c = 0
    for line in lines:
        if all(p.search(line) for p in patterns):
            c += 1
    return c


def extract_latencies(lines: list[str]) -> list[int]:
    vals: list[int] = []
    for line in lines:
        for p in LAT_PATTERNS:
            m = p.search(line)
            if m:
                try:
                    vals.append(int(m.group(1)))
                except Exception:
                    pass
    return vals


def p95(values: list[int]) -> int | None:
    if not values:
        return None
    if len(values) == 1:
        return values[0]
    # statistics.quantiles gives cut points; n=100 => percentiles.
    try:
        qs = quantiles(values, n=100, method="inclusive")
        return int(qs[94])  # 95th percentile
    except Exception:
        values_sorted = sorted(values)
        idx = int(round(0.95 * (len(values_sorted) - 1)))
        return values_sorted[idx]


def main() -> None:
    now = datetime.now(timezone.utc)
    since = now - timedelta(minutes=WINDOW_MIN)
    since_iso = since.strftime("%Y-%m-%d %H:%M:%S")

    lines = journal_lines(since_iso)

    capture_failed_count = sum(
        1
        for line in lines
        if any(p.search(line) for p in CAPTURE_PATTERNS)
    )

    # Fallback qdrant 400 detect (when docker logs are unavailable):
    # count lines that mention /points/search and 400.
    qdrant_400_count = count_matches(lines, QDRANT_400_PATTERNS)

    lat_vals = extract_latencies(lines)
    p95_latency_ms = p95(lat_vals)

    rec = {
        "ts": now.isoformat().replace("+00:00", "Z"),
        "window_min": WINDOW_MIN,
        "capture_failed_count": capture_failed_count,
        "qdrant_400_count": qdrant_400_count,
        "p95_latency_ms": p95_latency_ms,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    print(json.dumps({"ok": True, **rec}, ensure_ascii=False))


if __name__ == "__main__":
    main()
