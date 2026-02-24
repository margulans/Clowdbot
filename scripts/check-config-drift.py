#!/usr/bin/env python3
"""
Проверяет ключевые параметры openclaw.json и записывает config_drift
в incidents.jsonl при расхождении. Запускается из uchastkovy.
"""
import json
import hashlib
import os
from datetime import datetime, timezone

HOME = os.path.expanduser("~")
CONFIG_FILE = f"{HOME}/Clowdbot/.cursor/deployment/server-workspace/openclaw.json"
INCIDENTS_FILE = f"{HOME}/Clowdbot/.cursor/deployment/server-workspace/data/incidents.jsonl"
DROPINS_DIR = f"{HOME}/.config/systemd/user/openclaw-gateway.service.d"

EXPECTED = {
    "tools.web.search.provider": "perplexity",
    "channels.telegram.dmPolicy": "allowlist",
    "gateway.mode": "local",
}

REQUIRED_DROPINS = ["perplexity.conf", "openai.conf"]


def get_nested(obj, path):
    for key in path.split("."):
        if isinstance(obj, dict):
            obj = obj.get(key)
        else:
            return None
    return obj


def write_drift(severity, msg):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    id_ = hashlib.sha1(f"{msg}{ts}".encode()).hexdigest()[:8]
    entry = json.dumps({
        "id": id_, "ts": ts, "type": "config_drift",
        "source": "uchastkovy", "severity": severity,
        "msg": msg, "resolved": False
    }, ensure_ascii=False)
    with open(INCIDENTS_FILE, "a") as f:
        f.write(entry + "\n")
    print(f"DRIFT [{severity}]: {msg}")


def main():
    drifts = 0

    # Читаем конфиг
    try:
        with open(CONFIG_FILE) as f:
            config = json.load(f)
    except Exception as e:
        write_drift("critical", f"openclaw.json unreadable: {e}")
        return

    # Проверяем значения
    for path, expected in EXPECTED.items():
        actual = get_nested(config, path)
        if actual != expected:
            severity = "critical" if "dmPolicy" in path else "warn"
            write_drift(severity, f"{path} changed: expected {expected}, got {actual}")
            drifts += 1

    # Проверяем systemd drop-ins
    try:
        dropins = os.listdir(DROPINS_DIR)
    except Exception:
        dropins = []

    for required in REQUIRED_DROPINS:
        if required not in dropins:
            write_drift("warn", f"systemd drop-in missing: {required} — key lost")
            drifts += 1

    if drifts == 0:
        print("OK: no config drift detected")


if __name__ == "__main__":
    main()
