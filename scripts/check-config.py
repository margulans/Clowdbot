#!/usr/bin/env python3
"""
Сравнивает живой openclaw.json на VPS с ожидаемой структурой.
Запуск: python3 scripts/check-config.py
Требует: SSH-доступ к openclaw@100.73.176.127
"""

import json
import subprocess
import sys

VPS_USER = "openclaw"
VPS_HOST = "100.73.176.127"
VPS_CONFIG = "/home/openclaw/Clowdbot/.cursor/deployment/server-workspace/openclaw.json"

# Ключевые параметры: (json-путь, описание, признак-секрет)
CHECKS = [
    ("agents.defaults.model.primary",                          "Основная модель",               False),
    ("agents.defaults.model.fallbacks",                        "Fallback модели",               False),
    ("agents.defaults.contextPruning.mode",                    "Context pruning",               False),
    ("agents.defaults.compaction.memoryFlush.enabled",         "Memory flush",                  False),
    ("agents.defaults.memorySearch.experimental.sessionMemory","Session memory",                False),
    ("agents.defaults.memorySearch.model",                     "Embedding модель",              False),
    ("agents.defaults.maxConcurrent",                          "Max agents",                    False),
    ("agents.defaults.subagents.maxConcurrent",                "Max subagents",                 False),
    ("tools.web.search.provider",                              "Search provider",               False),
    ("tools.web.search.perplexity.model",                      "Perplexity model",              False),
    ("tools.web.search.perplexity.apiKey",                     "Perplexity API key",            True),
    ("tools.web.search.apiKey",                                "Brave API key (legacy)",        True),
    ("tools.media.audio.models",                               "Audio transcription",           False),
    ("channels.telegram.dmPolicy",                             "Telegram DM policy",            False),
    ("channels.telegram.allowFrom",                            "Telegram allowlist",            False),
    ("channels.telegram.reactionNotifications",                "Reaction notifications",        False),
    ("channels.telegram.reactionLevel",                        "Reaction level",                False),
    ("channels.telegram.streamMode",                           "Stream mode",                   False),
    ("messages.ackReactionScope",                              "Ack reaction scope",            False),
    ("messages.removeAckAfterReply",                           "Remove ack after reply",        False),
    ("gateway.port",                                           "Gateway port",                  False),
    ("gateway.mode",                                           "Gateway mode",                  False),
    ("plugins.slots.memory",                                   "Memory plugin",                 False),
]

PLACEHOLDER_PATTERN = "<"


def get_nested(obj, path):
    """Получить значение по точечному пути вида 'a.b.c'."""
    keys = path.split(".")
    for k in keys:
        if isinstance(obj, dict):
            obj = obj.get(k)
        elif isinstance(obj, list):
            try:
                obj = obj[int(k)]
            except (ValueError, IndexError):
                return None
        else:
            return None
    return obj


def fetch_config():
    result = subprocess.run(
        ["ssh", "-o", "ConnectTimeout=5", "-o", "BatchMode=yes",
         f"{VPS_USER}@{VPS_HOST}", f"cat {VPS_CONFIG}"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"❌ SSH ошибка: {result.stderr.strip()}")
        sys.exit(1)
    return json.loads(result.stdout)


def is_placeholder(value):
    return isinstance(value, str) and value.startswith(PLACEHOLDER_PATTERN)


def main():
    print(f"🔍 Читаю конфиг с VPS ({VPS_HOST})...\n")
    config = fetch_config()

    ok = []
    warnings = []
    secrets_missing = []

    for path, label, is_secret in CHECKS:
        value = get_nested(config, path)

        if value is None:
            warnings.append((label, path, "⚠️  отсутствует"))
        elif is_secret and is_placeholder(value):
            secrets_missing.append((label, path, f"🔑 заглушка: {value}"))
        elif not is_secret and is_placeholder(str(value)):
            warnings.append((label, path, f"⚠️  заглушка: {value}"))
        else:
            display = str(value)[:60] if not is_secret else "***"
            ok.append((label, path, display))

    print(f"{'Параметр':<35} {'JSON-путь':<50} {'Значение'}")
    print("-" * 120)

    for label, path, display in ok:
        print(f"✅ {label:<33} {path:<50} {display}")

    if warnings:
        print()
        for label, path, msg in warnings:
            print(f"⚠️  {label:<33} {path:<50} {msg}")

    if secrets_missing:
        print()
        for label, path, msg in secrets_missing:
            print(f"🔑 {label:<33} {path:<50} {msg}")

    print()
    print(f"Итого: ✅ {len(ok)}  ⚠️ {len(warnings)}  🔑 {len(secrets_missing)} (ключи-заглушки)")

    if secrets_missing:
        print("\n⚠️  Ключи-заглушки не критичны если они выставлены через systemd env drop-in файлы.")


if __name__ == "__main__":
    main()
