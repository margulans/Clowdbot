#!/bin/bash
# Удаляет сообщения из Telegram чата батчами по 100
# Usage: delete_messages.sh <BOT_TOKEN> <CHAT_ID> <FROM_ID> <TO_ID>

BOT_TOKEN="$1"
CHAT_ID="$2"
FROM_ID="$3"
TO_ID="$4"

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ] || [ -z "$FROM_ID" ] || [ -z "$TO_ID" ]; then
  echo "Usage: delete_messages.sh <BOT_TOKEN> <CHAT_ID> <FROM_ID> <TO_ID>"
  exit 1
fi

deleted=0
failed=0

# Батчи по 100 сообщений
start=$FROM_ID
while [ $start -le $TO_ID ]; do
  end=$((start + 99))
  if [ $end -gt $TO_ID ]; then
    end=$TO_ID
  fi

  IDS=$(python3 -c "import json; print(json.dumps(list(range($start, $end+1))))")

  result=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteMessages" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\": \"${CHAT_ID}\", \"message_ids\": ${IDS}}")

  if echo "$result" | grep -q '"ok":true'; then
    count=$((end - start + 1))
    deleted=$((deleted + count))
    echo "✅ Удалено $start-$end ($count сообщений)"
  else
    err=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('description','?'))")
    echo "⚠️  $start-$end: $err"
    failed=$((failed + end - start + 1))
  fi

  start=$((end + 1))
done

echo ""
echo "📊 Итого: удалено ~$deleted, не удалось ~$failed (старше 48ч)"
