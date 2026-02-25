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
  local service="$1"
  local detail="$2"
  local incident
  incident=$(printf '{"ts":"%s","type":"mem0_health","source":"%s","severity":"critical","detail":"%s","resolved":false}' \
    "$TIMESTAMP" "$service" "$detail")
  echo "$incident" >> "$INCIDENTS_FILE"
  echo "$TIMESTAMP ERROR $service: $detail" >> "$LOG_FILE"
  echo "FAIL: $service — $detail" >&2
  exit 1
}

ok() {
  echo "$TIMESTAMP OK all mem0 services healthy" >> "$LOG_FILE"
  echo "OK: Qdrant + Mem0 + SanitizerProxy"
  exit 0
}

# 1. Qdrant
QDRANT_RESP=$(curl -sf --max-time 5 "http://localhost:6333/healthz" 2>/dev/null || echo "CURL_FAIL")
if [[ "$QDRANT_RESP" == "CURL_FAIL" ]] || ! echo "$QDRANT_RESP" | grep -qi "healthy\|ok\|true"; then
  fail "qdrant" "healthz endpoint unreachable or unhealthy (response: ${QDRANT_RESP:0:100})"
fi

# 2. Mem0 OSS REST API
MEM0_RESP=$(curl -sf --max-time 5 "http://localhost:8000/health" 2>/dev/null || echo "CURL_FAIL")
if [[ "$MEM0_RESP" == "CURL_FAIL" ]] || ! echo "$MEM0_RESP" | grep -qi "ok\|healthy"; then
  fail "mem0-api" "/health endpoint unreachable or unhealthy (response: ${MEM0_RESP:0:100})"
fi

# 3. Sanitizer Proxy
PROXY_RESP=$(curl -sf --max-time 5 "http://localhost:8888/health" 2>/dev/null || echo "CURL_FAIL")
if [[ "$PROXY_RESP" == "CURL_FAIL" ]] || ! echo "$PROXY_RESP" | grep -qi "ok"; then
  fail "sanitizer-proxy" "/health endpoint unreachable or unhealthy (response: ${PROXY_RESP:0:100})"
fi

ok
