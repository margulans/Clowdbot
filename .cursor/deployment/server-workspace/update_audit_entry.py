
import json
import os

# Define the new entries for the audit message
new_sent_digest_entry = {"type":"news_meta", "digest":"evening", "date":"2026-02-27", "kind":"audit", "ts":1772172000000, "messageId":"3206"}
new_dual_rating_entry = {"messageId":"3206", "digest":"evening", "date":"2026-02-27", "type":"news_meta", "kind":"audit", "status":"sent", "ts":1772172000000}

sent_digests_path = "/home/openclaw/.openclaw/workspace/data/sent-digests.json"
dual_rating_path = "/home/openclaw/.openclaw/workspace/data/dual-rating-data.json"

def update_json_file(file_path, new_entry):
    data = []
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = [] # Handle empty or malformed JSON
    data.append(new_entry)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# Update sent-digests.json
update_json_file(sent_digests_path, new_sent_digest_entry)

# Update dual-rating-data.json
update_json_file(dual_rating_path, new_dual_rating_entry)

print("Files updated successfully for messageId 3206.")
