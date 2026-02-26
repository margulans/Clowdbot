#!/usr/bin/env bash
set -euo pipefail

# Воспроизводимый hotfix для mem0ai:
# 1) OpenAIEmbedder должен учитывать config.baseURL
# 2) ConfigManager.mergeConfig должен пробрасывать baseURL в embedder.config
#
# Скрипт безопасно идемпотентен: повторный запуск не ломает файл.

TARGET="${HOME}/.openclaw/extensions/openclaw-mem0/node_modules/mem0ai/dist/oss/index.js"

if [[ ! -f "${TARGET}" ]]; then
  echo "FAIL: mem0ai file not found: ${TARGET}" >&2
  exit 1
fi

BACKUP="${TARGET}.bak.$(date +%Y%m%d-%H%M%S)"
cp "${TARGET}" "${BACKUP}"

python3 - "${TARGET}" <<'PY'
import sys
from pathlib import Path

target = Path(sys.argv[1])
content = target.read_text()
patched = False

# Patch 1: OpenAIEmbedder constructor (use baseURL when present)
old_ctor = '    this.openai = new import_openai.default({ apiKey: config.apiKey });'
new_ctor = (
    '    const clientOpts = { apiKey: config.apiKey };\\n'
    '    if (config.baseURL) clientOpts.baseURL = config.baseURL;\\n'
    '    this.openai = new import_openai.default(clientOpts);'
)
if old_ctor in content:
    content = content.replace(old_ctor, new_ctor, 1)
    patched = True

# Patch 2: ConfigManager.mergeConfig should include embedder.config.baseURL
needle = '            url: userConf == null ? void 0 : userConf.url,\\n'
insertion = (
    '            url: userConf == null ? void 0 : userConf.url,\\n'
    '            baseURL: userConf == null ? void 0 : userConf.baseURL,\\n'
)
if insertion not in content and needle in content:
    content = content.replace(needle, insertion, 1)
    patched = True

target.write_text(content)
print("PATCHED" if patched else "ALREADY_PATCHED")
PY

echo "INFO: verifying patch..."

if ! rg -n "clientOpts\\.baseURL = config\\.baseURL" "${TARGET}" >/dev/null; then
  echo "FAIL: OpenAIEmbedder baseURL patch missing" >&2
  exit 1
fi

if ! rg -n "baseURL: userConf == null \\? void 0 : userConf\\.baseURL" "${TARGET}" >/dev/null; then
  echo "FAIL: ConfigManager baseURL merge patch missing" >&2
  exit 1
fi

echo "OK: mem0ai hotfix applied and verified"
echo "INFO: backup saved to ${BACKUP}"
