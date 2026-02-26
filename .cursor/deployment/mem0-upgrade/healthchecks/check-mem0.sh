#!/usr/bin/env bash
# Healthcheck для Mem0 memory stack
# Используется Участковым (uchastkovy) каждые 10 мин
# Выход 0 = всё в порядке, 1 = проблема (пишет инцидент)
#
# Запуск: ./check-mem0.sh
# Интеграция: вызывать из uchastkovy/SKILL.md в pre-flight блоке

set -euo pipefail

INCIDENTS_FILE="${HOME}/.openclaw/workspace/data/incidents.jsonl"
LOG_FILE="${HOME}/.openclaw/logs/check-mem0.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$(dirname "$INCIDENTS_FILE")" "$(dirname "$LOG_FILE")"

fail() {
  local type="$1"     # mem0_health | mem0_e2e_failed
  local service="$2"  # qdrant | sanitizer-proxy | e2e
  local detail="$3"

  # Safe JSON encoding (detail may contain quotes/newlines)
  local incident
  incident=$(python3 - "$TIMESTAMP" "$type" "$service" "$detail" <<'PY'
import json, sys
(ts, typ, src, detail) = sys.argv[1:5]
print(json.dumps({
  "ts": ts,
  "type": typ,
  "source": src,
  "severity": "critical",
  "detail": detail,
  "resolved": False,
}, ensure_ascii=False))
PY
)

  echo "$incident" >> "$INCIDENTS_FILE"
  echo "$TIMESTAMP ERROR $type $service: ${detail:0:500}" >> "$LOG_FILE"
  echo "FAIL: $type $service — ${detail:0:500}" >&2
  exit 1
}

ok() {
  echo "$TIMESTAMP OK all mem0 services healthy" >> "$LOG_FILE"
  echo "OK: Qdrant + Mem0 + SanitizerProxy"
  exit 0
}

# 1. Qdrant
# Qdrant возвращает "healthz check passed" — матчим по слову "passed" тоже
QDRANT_RESP=$(curl -sf --max-time 5 "http://localhost:6333/healthz" 2>/dev/null || echo "CURL_FAIL")
if [[ "$QDRANT_RESP" == "CURL_FAIL" ]] || ! echo "$QDRANT_RESP" | grep -qi "healthy\|ok\|true\|passed"; then
  fail "mem0_health" "qdrant" "healthz endpoint unreachable or unhealthy (response: ${QDRANT_RESP:0:100})"
fi

# 2. Sanitizer Proxy
PROXY_RESP=$(curl -sf --max-time 5 "http://localhost:8888/health" 2>/dev/null || echo "CURL_FAIL")
if [[ "$PROXY_RESP" == "CURL_FAIL" ]] || ! echo "$PROXY_RESP" | grep -qi "ok"; then
  fail "mem0_health" "sanitizer-proxy" "/health endpoint unreachable or unhealthy (response: ${PROXY_RESP:0:100})"
fi

# 3. E2E: pseudo-embed -> upsert -> search -> cleanup (Qdrant)
E2E_OUT=$(python3 "${HOME}/.openclaw/workspace/scripts/mem0_qdrant_e2e.py" 2>&1 || true)
if ! echo "$E2E_OUT" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
  fail "mem0_e2e_failed" "e2e" "qdrant e2e failed: ${E2E_OUT:0:220}"
fi

echo "$TIMESTAMP OK mem0 e2e: $E2E_OUT" >> "$LOG_FILE"
ok
