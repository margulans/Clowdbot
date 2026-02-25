"""
Sanitizer Proxy для Mem0 OSS → OpenAI API
Перехватывает исходящие запросы, удаляет секреты и PII,
затем проксирует чистый текст на api.openai.com.

Запуск: uvicorn proxy:app --host 127.0.0.1 --port 8888
Логи:  ~/.openclaw/logs/sanitizer.log
"""

import re
import json
import logging
import os
from pathlib import Path
from datetime import datetime

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse

# Настройка лога
LOG_DIR = Path.home() / ".openclaw" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    filename=str(LOG_DIR / "sanitizer.log"),
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("sanitizer-proxy")

UPSTREAM = "https://api.openai.com"

# Паттерны для удаления секретов
SECRET_PATTERNS = [
    (r"sk-[A-Za-z0-9\-_]{20,}", "SK_REDACTED"),
    (r"sk-proj-[A-Za-z0-9\-_]{20,}", "SK_REDACTED"),
    (r"AKIA[A-Z0-9]{16}", "AWS_KEY_REDACTED"),
    (r"Bearer\s+[A-Za-z0-9\-_\.]{20,}", "Bearer TOKEN_REDACTED"),
    # Внутренние URL с токенами
    (r"https?://[^\s\"']+[?&]token=[^\s\"'&]+", "URL_WITH_TOKEN_REDACTED"),
    (r"https?://[^\s\"']+[?&]api_key=[^\s\"'&]+", "URL_WITH_KEY_REDACTED"),
]

# Паттерны для редактирования PII
PII_PATTERNS = [
    (r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b", "EMAIL_REDACTED"),
    (r"\b(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}\b", "PHONE_REDACTED"),
    (r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", "PHONE_REDACTED"),
]


def sanitize_text(text: str) -> tuple[str, list[str]]:
    """Вернуть очищенный текст и список того, что было удалено."""
    redacted = []
    for pattern, replacement in SECRET_PATTERNS:
        cleaned, n = re.subn(pattern, replacement, text)
        if n:
            redacted.append(f"secret({replacement}×{n})")
        text = cleaned
    for pattern, replacement in PII_PATTERNS:
        cleaned, n = re.subn(pattern, replacement, text)
        if n:
            redacted.append(f"pii({replacement}×{n})")
        text = cleaned
    return text, redacted


def sanitize_json_strings(obj, depth: int = 0) -> tuple[any, list[str]]:
    """Рекурсивно очистить все строковые значения в JSON-объекте."""
    if depth > 20:
        return obj, []
    all_redacted: list[str] = []
    if isinstance(obj, str):
        cleaned, redacted = sanitize_text(obj)
        return cleaned, redacted
    elif isinstance(obj, dict):
        result = {}
        for key, value in obj.items():
            # Authorization header — не трогаем (ключ остаётся, он нужен для auth)
            if key.lower() == "authorization":
                result[key] = value
                continue
            cleaned, redacted = sanitize_json_strings(value, depth + 1)
            result[key] = cleaned
            all_redacted.extend(redacted)
        return result, all_redacted
    elif isinstance(obj, list):
        result = []
        for item in obj:
            cleaned, redacted = sanitize_json_strings(item, depth + 1)
            result.append(cleaned)
            all_redacted.extend(redacted)
        return result, all_redacted
    return obj, []


app = FastAPI(title="Sanitizer Proxy", version="1.0")


@app.get("/health")
async def health():
    return {"status": "ok", "upstream": UPSTREAM}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy(request: Request, path: str):
    body_bytes = await request.body()
    content_type = request.headers.get("content-type", "")
    redacted_fields: list[str] = []

    # Очищаем тело запроса если это JSON
    if "application/json" in content_type and body_bytes:
        try:
            body_obj = json.loads(body_bytes)
            body_obj, redacted_fields = sanitize_json_strings(body_obj)
            body_bytes = json.dumps(body_obj, ensure_ascii=False).encode()
        except json.JSONDecodeError:
            # Не JSON — очищаем как текст
            text, redacted_fields = sanitize_text(body_bytes.decode(errors="replace"))
            body_bytes = text.encode()

    if redacted_fields:
        logger.warning("SANITIZED path=/%s fields=%s", path, redacted_fields)
    else:
        logger.info("PROXIED path=/%s bytes=%d", path, len(body_bytes))

    # Передаём заголовки клиента (без host)
    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in ("host", "content-length")
    }

    url = f"{UPSTREAM}/{path}"
    if request.url.query:
        url += f"?{request.url.query}"

    async with httpx.AsyncClient(timeout=120.0) as client:
        upstream_resp = await client.request(
            method=request.method,
            url=url,
            headers=headers,
            content=body_bytes,
        )

    # Стриминговый ответ, чтобы не буферизовать большие тела
    return Response(
        content=upstream_resp.content,
        status_code=upstream_resp.status_code,
        headers=dict(upstream_resp.headers),
    )
