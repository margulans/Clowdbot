#!/usr/bin/env python3
"""Persistent runtime-state helpers for Lobster Mekhanik.

State is stored as JSON at:
  ~/.openclaw/.runtime/mekhanik-state.json

Per incident_key we track:
- attempts
- fail_events (timestamps)
- window_start
- last_action_ts

This enables restart-guard + circuit-breaker without cross-incident blocking.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, asdict

STATE_PATH = os.path.expanduser("~/.openclaw/.runtime/mekhanik-state.json")


@dataclass
class IncidentState:
    incident_key: str
    attempts: int = 0
    fail_events: list[float] = None
    window_start: float = 0.0
    last_action_ts: float = 0.0

    def __post_init__(self):
        if self.fail_events is None:
            self.fail_events = []


def load_state(path: str = STATE_PATH) -> dict:
    if not os.path.exists(path):
        return {"version": 1, "updated_at": time.time(), "incidents": {}}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_state(state: dict, path: str = STATE_PATH) -> None:
    """Atomic state write: write *.tmp -> fsync -> rename.

    Raises on failure.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)
    state["updated_at"] = time.time()

    tmp_path = path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())

    os.replace(tmp_path, path)


def get_incident(state: dict, incident_key: str) -> IncidentState:
    inc = (state.get("incidents") or {}).get(incident_key)
    if not inc:
        return IncidentState(incident_key=incident_key, window_start=time.time())
    return IncidentState(
        incident_key=incident_key,
        attempts=int(inc.get("attempts", 0) or 0),
        fail_events=list(inc.get("fail_events", []) or []),
        window_start=float(inc.get("window_start", 0.0) or 0.0),
        last_action_ts=float(inc.get("last_action_ts", 0.0) or 0.0),
    )


def put_incident(state: dict, inc: IncidentState) -> None:
    state.setdefault("incidents", {})
    state["incidents"][inc.incident_key] = asdict(inc)


def cleanup_stale(state: dict, now: float, stale_s: int = 24 * 3600) -> None:
    incidents = state.get("incidents") or {}
    keep = {}
    for k, v in incidents.items():
        last = float(v.get("last_action_ts", 0.0) or 0.0)
        if last and (now - last) < stale_s:
            keep[k] = v
    state["incidents"] = keep
