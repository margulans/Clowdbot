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
CONFIG_FILE = f"{HOME}/.openclaw/openclaw.json"
INCIDENTS_FILE = f"{HOME}/.openclaw/workspace/data/incidents.jsonl"
DROPINS_DIR = f"{HOME}/.config/systemd/user/openclaw-gateway.service.d"
USER_UNITS_DIR = f"{HOME}/.config/systemd/user"

EXPECTED = {
    "tools.web.search.provider": "perplexity",
    "channels.telegram.dmPolicy": "allowlist",
    "gateway.mode": "local",
}

REQUIRED_DROPINS = ["perplexity.conf", "openai.conf"]

# Задокументированные user unit-файлы (обновлять при добавлении нового сервиса)
KNOWN_UNITS = {
    "openclaw-gateway.service",
    "telegram-polling-watchdog.service",
    "telegram-polling-watchdog.timer",
    "telegram-reaction-webhook.service",
}


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


def check_undocumented_units():
    """Обнаруживает user unit-файлы не из KNOWN_UNITS."""
    drifts = 0
    try:
        files = os.listdir(USER_UNITS_DIR)
    except Exception as e:
        print(f"WARN: не могу прочитать {USER_UNITS_DIR}: {e}")
        return 0

    for fname in files:
        if not (fname.endswith(".service") or fname.endswith(".timer")):
            continue
        # Пропускаем drop-in директории (например openclaw-gateway.service.d)
        full_path = os.path.join(USER_UNITS_DIR, fname)
        if os.path.isdir(full_path):
            continue
        if fname not in KNOWN_UNITS:
            write_drift(
                "warn",
                f"undocumented systemd unit: {fname} — add to server-config.md and KNOWN_UNITS in check-config-drift.py"
            )
            drifts += 1

    return drifts


def main():
    drifts = 0

    try:
        with open(CONFIG_FILE) as f:
            config = json.load(f)
    except Exception as e:
        write_drift("critical", f"openclaw.json unreadable: {e}")
        return

    for path, expected in EXPECTED.items():
        actual = get_nested(config, path)
        if actual != expected:
            severity = "critical" if "dmPolicy" in path else "warn"
            write_drift(severity, f"{path} changed: expected {expected}, got {actual}")
            drifts += 1

    try:
        dropins = os.listdir(DROPINS_DIR)
    except Exception:
        dropins = []

    for required in REQUIRED_DROPINS:
        if required not in dropins:
            write_drift("warn", f"systemd drop-in missing: {required} — key lost")
            drifts += 1

    drifts += check_undocumented_units()

    if drifts == 0:
        print("OK: no config drift detected")


if __name__ == "__main__":
    main()
