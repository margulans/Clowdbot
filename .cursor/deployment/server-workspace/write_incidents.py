
import json
import hashlib
import datetime

incidents = []
current_time = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds') + 'Z'

# Incident 1
incidents.append({
    "type": "cron_error",
    "job": "ba31c42d-be5d-486e-9897-6fb4fa6ae2ed (Дневные мнения)",
    "severity": "critical",
    "msg": "Cron job 'Дневные мнения' reported an error status."
})

# Incident 2
incidents.append({
    "type": "cron_error",
    "job": "ce006db5-350b-44be-baef-8b216ed687e4 (Auto-commit: Git sync)",
    "severity": "critical",
    "msg": "Cron job 'Auto-commit: Git sync' reported an error status."
})

# Incident 3
incidents.append({
    "type": "cron_error",
    "job": "582cc3f0-9941-4e74-ae77-0afac52c6258 (Вечерний дайджест @newsneiron)",
    "severity": "critical",
    "msg": "Cron job 'Вечерний дайджест @newsneiron' reported an error status."
})

# Incident 4
incidents.append({
    "type": "cron_error",
    "job": "89db97f7-e05e-4e3b-990b-fefc1815e7d7 (🕵️ Чекист (ночь))",
    "severity": "critical",
    "msg": "Cron job '🕵️ Чекист (ночь)' reported an error status."
})

# Incident 5
incidents.append({
    "type": "cron_error",
    "job": "829eee9e-de87-4c35-82ed-a469ac67afc2 (🚨 BACKUP: Утренний брифинг)",
    "severity": "critical",
    "msg": "Cron job '🚨 BACKUP: Утренний брифинг' reported an error status."
})

# Incident 6
incidents.append({
    "type": "git_dirty",
    "job": "N/A",
    "severity": "warn",
    "msg": "Uncommitted files detected in git (filtered)"
})


output_lines = []
for incident in incidents:
    incident["ts"] = current_time
    incident["source"] = "uchastkovy"
    incident["resolved"] = False
    
    # Generate ID
    id_string = f"{incident['type']}+{incident['job']}+{incident['ts']}"
    incident_id = hashlib.sha1(id_string.encode('utf-8')).hexdigest()[:8]
    incident["id"] = incident_id
    
    output_lines.append(json.dumps(incident, ensure_ascii=False))

with open("/home/openclaw/.openclaw/workspace/data/incidents.jsonl", "a", encoding="utf-8") as f:
    for line in output_lines:
        f.write(line + "\n")

print(f"Recorded {len(incidents)} incidents to data/incidents.jsonl")
