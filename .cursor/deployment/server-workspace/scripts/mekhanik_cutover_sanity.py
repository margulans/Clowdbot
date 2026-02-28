#!/usr/bin/env python3
"""Sanity/verifier helper for Lobster cutovers.

Purpose: compute elapsedSeconds and lobster-scoped deltas deterministically.

Inputs:
  --baseline <path>  JSON with {startTs:<isoZ>}.
  --incidents <path> incidents.jsonl
  --metrics <path>   metrics jsonl (optional)
  --sources <comma>  allowed sources for lobster scope
  --max-elapsed-seconds <int> guardrail (default 8h)

Outputs JSON to stdout:
  {
    nowTs,
    startTs,
    elapsedSeconds,
    elapsed_valid,
    metric_invalid_reason,
    deltas:{critical,transport,rollback},
    guards:{...}
  }
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def parse_iso(ts: str) -> datetime:
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    return datetime.fromisoformat(ts).astimezone(timezone.utc)


def iso_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def read_last_json_line(path: Path) -> dict | None:
    if not path.exists():
        return None
    last = None
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        last = line
    if not last:
        return None
    try:
        return json.loads(last)
    except Exception:
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", required=True)
    ap.add_argument(
        "--incidents",
        default="/home/openclaw/.openclaw/workspace/data/incidents.jsonl",
    )
    ap.add_argument("--metrics", default=None)
    ap.add_argument(
        "--sources",
        default="mekhanik-lobster,lobster-mekhanik",
        help="Comma-separated sources for lobster scope",
    )
    ap.add_argument("--max-elapsed-seconds", type=int, default=8 * 3600)
    args = ap.parse_args()

    now = datetime.now(timezone.utc)

    baseline_path = Path(args.baseline)
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    start_ts = baseline.get("startTs")
    if not isinstance(start_ts, str) or not start_ts:
        raise SystemExit("baseline.startTs missing or not a string")

    start = parse_iso(start_ts)
    elapsed = int((now - start).total_seconds())

    elapsed_valid = True
    invalid_reason = None
    if elapsed <= 0:
        elapsed_valid = False
        invalid_reason = "elapsed_non_positive"
    elif elapsed > int(args.max_elapsed_seconds):
        elapsed_valid = False
        invalid_reason = "elapsed_exceeds_guardrail"

    sources = {s.strip() for s in args.sources.split(",") if s.strip()}

    incidents_path = Path(args.incidents)

    d_critical = 0
    d_transport = 0
    d_rollback = 0

    for line in incidents_path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except Exception:
            continue

        src = rec.get("source")
        if src not in sources:
            continue

        ts = rec.get("ts")
        if not isinstance(ts, str):
            continue
        try:
            t = parse_iso(ts)
        except Exception:
            continue
        if t < start:
            continue

        typ = str(rec.get("type") or "")

        if rec.get("severity") == "critical":
            d_critical += 1

        if typ == "message_transport_failed":
            d_transport += 1

        if "rollback" in typ:
            d_rollback += 1

    guards = {
        "state_write_failed": None,
        "restart_loop_blocked": None,
        "circuit_breaker_triggered": None,
    }

    if args.metrics:
        m = read_last_json_line(Path(args.metrics))
        if isinstance(m, dict):
            for k in list(guards.keys()):
                guards[k] = m.get(k)

    out = {
        "nowTs": iso_z(now),
        "startTs": iso_z(start),
        "elapsedSeconds": elapsed,
        "elapsed_valid": elapsed_valid,
        "metric_invalid_reason": invalid_reason,
        "deltas": {
            "critical": d_critical,
            "transport": d_transport,
            "rollback": d_rollback,
        },
        "guards": guards,
    }

    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
