
import json
import os

sent_digests_path = "/home/openclaw/.openclaw/workspace/data/sent-digests.json"
dual_rating_path = "/home/openclaw/.openclaw/workspace/data/dual-rating-data.json"

def validate_digest_data():
    # Load sent-digests.json
    sent_digests_data = []
    if os.path.exists(sent_digests_path):
        with open(sent_digests_path, "r", encoding="utf-8") as f:
            try:
                sent_digests_data = json.load(f)
            except json.JSONDecodeError:
                print(f"Error: {sent_digests_path} is malformed JSON.")
                return False

    # Load dual-rating-data.json
    dual_rating_data = []
    if os.path.exists(dual_rating_path):
        with open(dual_rating_path, "r", encoding="utf-8") as f:
            try:
                dual_rating_data = json.load(f)
            except json.JSONDecodeError:
                print(f"Error: {dual_rating_path} is malformed JSON.")
                return False

    # --- Validation for sent-digests.json ---
    # a) >= 10 entries type=news digest=evening c messageId
    news_entries_count = 0
    header_found = False
    audit_found = False
    expected_message_ids = set()

    for entry in sent_digests_data:
        if entry.get("type") == "news" and \
           entry.get("digest") == "evening" and \
           entry.get("date") == "2026-02-27" and \
           "messageId" in entry:
            news_entries_count += 1
            expected_message_ids.add(entry["messageId"])
        elif entry.get("type") == "news_meta" and \
             entry.get("digest") == "evening" and \
             entry.get("date") == "2026-02-27" and \
             "messageId" in entry:
            if entry.get("kind") == "header":
                header_found = True
                expected_message_ids.add(entry["messageId"])
            elif entry.get("kind") == "audit":
                audit_found = True
                expected_message_ids.add(entry["messageId"])

    if news_entries_count < 10:
        print(f"Validation failed: Expected at least 10 news entries, found {news_entries_count}.")
        return False

    if not header_found:
        print("Validation failed: News meta header not found in sent-digests.json.")
        return False

    if not audit_found:
        print("Validation failed: News meta audit not found in sent-digests.json.")
        return False

    # --- Validation for dual-rating-data.json ---
    # entries messageHistory for all sent messageId
    actual_message_ids_in_dual_rating = {entry.get("messageId") for entry in dual_rating_data if "messageId" in entry}

    if not expected_message_ids.issubset(actual_message_ids_in_dual_rating):
        missing_ids = expected_message_ids - actual_message_ids_in_dual_rating
        print(f"Validation failed: Missing message IDs in dual-rating-data.json: {missing_ids}")
        return False

    print("Final validation successful!")
    return True

if not validate_digest_data():
    raise Exception("Digest validation failed.")
