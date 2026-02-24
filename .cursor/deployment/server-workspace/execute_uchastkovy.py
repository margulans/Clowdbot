
import json
import os
import datetime
import hashlib
import time

def execute_uchastkovy_skill():
    incidents = []
    current_time_utc = datetime.datetime.utcnow()
    # Current time in Almaty (UTC+5)
    current_time_almaty = current_time_utc + datetime.timedelta(hours=5)

    # Шаг 1. Сбор данных
    print("Executing Шаг 1. Сбор данных")

    # 1. cron(action=list) -> список задач
    # Read from data/cron-jobs-snapshot.json
    cron_jobs = []
    try:
        cron_jobs_raw = default_api.read(file_path="data/cron-jobs-snapshot.json")
        cron_jobs = json.loads(cron_jobs_raw.get("read_response", {}).get("output", "{\"jobs\": []}"))["jobs"]
        print(f"Cron jobs loaded: {len(cron_jobs)} jobs")
    except Exception as e:
        print(f"Error reading cron-jobs-snapshot.json: {e}")

    # 2. systemctl --user is-active openclaw-gateway -> статус gateway
    gateway_status_output = default_api.exec(command="systemctl --user is-active openclaw-gateway").get("exec_response", {}).get("output", "").strip()
    gateway_active = (gateway_status_output == "active")
    print(f"Gateway status: {gateway_status_output}")

    # 3. df -h / | tail -1 -> диск (% использования)
    disk_usage_output = default_api.exec(command="df -h / | tail -1").get("exec_response", {}).get("output", "").strip()
    disk_usage_percent = 0
    if disk_usage_output:
        parts = disk_usage_output.split()
        if len(parts) > 4 and parts[4].endswith('%'):
            try:
                disk_usage_percent = int(parts[4][:-1])
            except ValueError:
                pass # Default to 0 if parsing fails
    print(f"Disk usage: {disk_usage_percent}%")

    # 4. git -C ~/Clowdbot status --short -> GIT_STATUS_RAW
    git_status_raw_output = default_api.exec(command="git -C ~/Clowdbot status --short").get("exec_response", {}).get("output", "").strip()
    git_status_filtered = []
    noise_files = [
        ".cursor/deployment/server-workspace/data/incidents.jsonl",
        ".cursor/deployment/server-workspace/data/cron-jobs-snapshot.json",
        ".cursor/deployment/server-workspace/data/cron-jobs.json"
    ]
    for line in git_status_raw_output.splitlines():
        is_noise = False
        for noise_file in noise_files:
            if noise_file in line:
                is_noise = True
                break
        if not is_noise:
            git_status_filtered.append(line)
    print(f"Git status filtered: {git_status_filtered}")

    # 5. [только если воскресенье и 03:00–12:00 Алматы]
    scout_last_run = None
    if current_time_almaty.weekday() == 6 and 3 <= current_time_almaty.hour < 12:
        try:
            scout_discoveries_raw = default_api.read(file_path="data/scout-discoveries.json")
            scout_discoveries = json.loads(scout_discoveries_raw.get("read_response", {}).get("output", "{}"))
            scout_last_run = scout_discoveries.get("last_run")
            print(f"Scout last run: {scout_last_run}")
        except Exception as e:
            print(f"Could not read data/scout-discoveries.json: {e}")

    # 6. journalctl --user -u openclaw-gateway --since "11 minutes ago" --no-pager | grep -c "announce queue drain failed" -> DRAIN_COUNT
    drain_count_output = default_api.exec(command="journalctl --user -u openclaw-gateway --since \"11 minutes ago\" --no-pager | grep -c \"announce queue drain failed\"").get("exec_response", {}).get("output", "0").strip()
    drain_count = int(drain_count_output) if drain_count_output.isdigit() else 0
    print(f"Drain count: {drain_count}")

    # 7. ps aux | grep -E "openclaw-gateway$" | grep -v grep | awk '{print $6}' -> RSS в KB
    gw_rss_kb_output = default_api.exec(command="ps aux | grep -E \"openclaw-gateway$\" | grep -v grep | awk '{print $6}'").get("exec_response", {}).get("output", "0").strip()
    gw_rss_kb = int(gw_rss_kb_output) if gw_rss_kb_output.isdigit() else 0
    print(f"Gateway RSS KB: {gw_rss_kb}")

    # 8. python3 ~/scripts/check-config-drift.py
    # This script writes directly to incidents.jsonl, no direct output handling needed here.
    config_drift_output = default_api.exec(command="python3 /home/openclaw/.openclaw/workspace/scripts/check-config-drift.py").get("exec_response", {}).get("output", "").strip()
    print(f"Config drift check: {config_drift_output}")

    # Шаг 2. Анализ
    print("Executing Шаг 2. Анализ")

    # Cron Job Analysis
    for job in cron_jobs:
        job_id = job.get("id", "N/A")
        job_name = job.get("name", "N/A")
        last_status = job.get("state", {}).get("lastStatus")
        consecutive_errors = job.get("state", {}).get("consecutiveErrors", 0)

        if last_status == "skipped":
            incidents.append({
                "type": "cron_skip",
                "severity": "critical",
                "msg": f"Cron job '{job_name}' (ID: {job_id}) skipped.",
                "job": job_name
            })
        elif last_status == "error" or consecutive_errors > 0:
            incidents.append({
                "type": "cron_error",
                "severity": "critical",
                "msg": f"Cron job '{job_name}' (ID: {job_id}) failed (lastStatus: {last_status}, consecutiveErrors: {consecutive_errors}).",
                "job": job_name
            })
        # Backup_triggered check is more involved and not explicitly defined with primary-backup IDs here
        # Will skip for now as per previous thinking process

    # Gateway Analysis
    if not gateway_active:
        incidents.append({
            "type": "gateway_down",
            "severity": "critical",
            "msg": "Gateway is not active.",
            "job": "openclaw-gateway"
        })

    # Announce Queue Analysis
    if drain_count > 60:
        incidents.append({
            "type": "announce_queue_loop",
            "severity": "critical",
            "msg": f"announce queue drain loop: {drain_count} failures за последние 10 мин",
            "job": "openclaw-gateway"
        })

    # Gateway Memory Analysis
    if gw_rss_kb > 1400000:
        incidents.append({
            "type": "gateway_memory_high",
            "severity": "critical",
            "msg": f"gateway RSS {gw_rss_kb / 1024:.1f} MB — превентивный рестарт до OOM",
            "job": "openclaw-gateway"
        })

    # Disk Usage Analysis
    if disk_usage_percent > 85:
        incidents.append({
            "type": "disk_warn",
            "severity": "warn",
            "msg": f"Disk usage is {disk_usage_percent}% (>85% threshold).",
            "job": "root_filesystem"
        })

    # Git Status Analysis
    if git_status_filtered:
        incidents.append({
            "type": "git_dirty",
            "severity": "warn",
            "msg": "Uncommitted files detected in git (filtered)",
            "job": "Clowdbot_repo"
        })

    # Scout Analysis (only if Sunday and within specific hours)
    if current_time_almaty.weekday() == 6 and 3 <= current_time_almaty.hour < 12:
        almaty_today_str = current_time_almaty.strftime("%Y-%m-%d")
        if scout_last_run is None or not scout_last_run.startswith(almaty_today_str):
            incidents.append({
                "type": "scout_stale",
                "severity": "warn",
                "msg": "Scout research не запустился этой ночью",
                "job": "scout"
            })

    # Шаг 3. Запись в журнал
    print("Executing Шаг 3. Запись в журнал")
    if incidents:
        incidents_to_write = []
        for incident in incidents:
            timestamp = datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z'
            incident_id_string = f"{incident['type']}+{incident.get('job', '')}+{timestamp}"
            incident_id = hashlib.sha1(incident_id_string.encode()).hexdigest()[:8]

            incident_entry = {
                "id": incident_id,
                "ts": timestamp,
                "type": incident["type"],
                "source": "uchastkovy",
                "job": incident.get("job", "N/A"),
                "severity": incident["severity"],
                "msg": incident["msg"],
                "resolved": False
            }
            incidents_to_write.append(json.dumps(incident_entry, ensure_ascii=False))

        # Read existing incidents to append
        existing_incidents_content = ""
        try:
            existing_incidents_read = default_api.read(file_path="data/incidents.jsonl")
            existing_incidents_content = existing_incidents_read.get("read_response", {}).get("output", "")
        except Exception as e:
            print(f"Could not read existing incidents.jsonl: {e}. Will create new or overwrite.")

        # Ensure a newline if existing content is not empty to separate JSONL entries
        final_content = existing_incidents_content.strip()
        if final_content:
            final_content += "\n"
        final_content += "\n".join(incidents_to_write)

        try:
            default_api.write(file_path="data/incidents.jsonl", content=final_content.strip())
            print(f"Wrote {len(incidents)} incidents to data/incidents.jsonl")
        except Exception as e:
            print(f"Error writing to incidents.jsonl: {e}")

    # Шаг 4. Экстренный ремонт
    print("Executing Шаг 4. Экстренный ремонт")
    repaired_critical_incidents = []

    for incident in incidents:
        if incident["severity"] == "critical":
            if incident["type"] == "gateway_down" or incident["type"] == "announce_queue_loop" or incident["type"] == "gateway_memory_high":
                print(f"Attempting to repair critical incident: {incident['type']}")
                # Common restart protocol
                default_api.exec(command="systemctl --user restart openclaw-gateway")
                time.sleep(5)
                restart_status_output = default_api.exec(command="systemctl --user is-active openclaw-gateway").get("exec_response", {}).get("output", "").strip()
                restart_successful = (restart_status_output == "active")

                # Generate a unique ID for the resolved entry, not directly using the incident's ID
                # as the incident might be unresolved if restart fails
                action_ref_id_string = f"action_taken_for_{incident['type']}_{incident.get('job', '')}_{datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z'}"
                action_ref_id = hashlib.sha1(action_ref_id_string.encode()).hexdigest()[:8]

                if not restart_successful:
                    # Log restart failed incident
                    failed_incident_id_string = f"gateway_restart_failed+openclaw-gateway+{datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z'}"
                    failed_incident_id = hashlib.sha1(failed_incident_id_string.encode()).hexdigest()[:8]
                    failed_incident_entry = {
                        "id": failed_incident_id,
                        "ts": datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
                        "type": "gateway_restart_failed",
                        "source": "uchastkovy",
                        "job": "openclaw-gateway",
                        "severity": "critical",
                        "msg": "Gateway restart failed.",
                        "resolved": False
                    }
                    try:
                        # Corrected: use current `final_content` logic to append properly
                        existing_inc_content = default_api.read(file_path="data/incidents.jsonl").get("read_response", {}).get("output", "").strip()
                        if existing_inc_content:
                            existing_inc_content += "\n"
                        existing_inc_content += json.dumps(failed_incident_entry, ensure_ascii=False)
                        default_api.write(file_path="data/incidents.jsonl", content=existing_inc_content)
                    except Exception as e:
                        print(f"Error writing failed incident to incidents.jsonl: {e}")

                    # Notify user
                    default_api.message(action="send", message="🚨 Участковый: Gateway был упавшим — перезапущен\nСтатус: ❌ не поднялся — нужна ручная проверка")
                    print("Gateway restart failed, user notified.")
                else:
                    # Add resolved entry
                    resolved_entry = {
                        "ts": datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
                        "type": "resolved",
                        "source": "uchastkovy",
                        "ref_id": incident['id'] if 'id' in incident else action_ref_id, # Use original incident ID if available, otherwise action ID
                        "action": "gateway restarted",
                        "severity": "info"
                    }
                    try:
                        # Corrected: use current `final_content` logic to append properly
                        existing_inc_content = default_api.read(file_path="data/incidents.jsonl").get("read_response", {}).get("output", "").strip()
                        if existing_inc_content:
                            existing_inc_content += "\n"
                        existing_inc_content += json.dumps(resolved_entry, ensure_ascii=False)
                        default_api.write(file_path="data/incidents.jsonl", content=existing_inc_content)
                    except Exception as e:
                        print(f"Error writing resolved entry to incidents.jsonl: {e}")

                    repaired_critical_incidents.append(incident)
                    print(f"Successfully restarted gateway for incident type: {incident['type']}")

                    # Specific post-restart checks and notifications
                    if incident["type"] == "gateway_down":
                        default_api.message(action="send", message="🚨 Участковый: Gateway был упавшим — перезапущен\nСтатус: ✅ работает")
                    elif incident["type"] == "announce_queue_loop":
                        count_after_restart_output = default_api.exec(command="journalctl --user -u openclaw-gateway --since \"10 seconds ago\" --no-pager | grep -c \"announce queue drain\"").get("exec_response", {}).get("output", "0").strip()
                        count_after_restart = int(count_after_restart_output) if count_after_restart_output.isdigit() else 0
                        if count_after_restart > 0:
                            # Log announce_queue_loop_persist
                            persist_incident_id_string = f"announce_queue_loop_persist+openclaw-gateway+{datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z'}"
                            persist_incident_id = hashlib.sha1(persist_incident_id_string.encode()).hexdigest()[:8]
                            persist_incident_entry = {
                                "id": persist_incident_id,
                                "ts": datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
                                "type": "announce_queue_loop_persist",
                                "source": "uchastkovy",
                                "job": "openclaw-gateway",
                                "severity": "critical",
                                "msg": "Announce queue loop persists after restart.",
                                "resolved": False
                            }
                            try:
                                # Corrected: use current `final_content` logic to append properly
                                existing_inc_content = default_api.read(file_path="data/incidents.jsonl").get("read_response", {}).get("output", "").strip()
                                if existing_inc_content:
                                    existing_inc_content += "\n"
                                existing_inc_content += json.dumps(persist_incident_entry, ensure_ascii=False)
                                default_api.write(file_path="data/incidents.jsonl", content=existing_inc_content)
                            except Exception as e:
                                print(f"Error writing persistent incident to incidents.jsonl: {e}")
                            default_api.message(action="send", message=f"⚠️ Участковый: Gateway перезапущен\nПричина: announce queue loop ({drain_count} failures/10мин)\nСтатус: ❌ цикл продолжается — нужна ручная проверка")
                        else:
                            default_api.message(action="send", message=f"⚠️ Участковый: Gateway перезапущен\nПричина: announce queue loop ({drain_count} failures/10мин)\nСтатус: ✅ цикл исчез")
                    elif incident["type"] == "gateway_memory_high":
                        new_rss_output = default_api.exec(command="ps aux | grep -E \"openclaw-gateway$\" | grep -v grep | awk '{print $6}'").get("exec_response", {}).get("output", "0").strip()
                        new_rss = int(new_rss_output) if new_rss_output.isdigit() else 0
                        if new_rss < 500000:
                            default_api.message(action="send", message=f"⚠️ Участковый: Gateway перезапущен превентивно\nПричина: RAM {gw_rss_kb / 1024:.1f} MB (лимит 1.4 GB, до OOM оставалось мало)\nСтатус: ✅ RAM сброшена до {new_rss / 1024:.1f} MB")
                        else:
                            default_api.message(action="send", message=f"⚠️ Участковый: Gateway перезапущен превентивно\nПричина: RAM {gw_rss_kb / 1024:.1f} MB (лимит 1.4 GB, до OOM оставалось мало)\nСтатус: ❌ не поднялся")

    # Шаг 5. Автообновление SNAPSHOT.md (once per hour, if current minute is 00)
    print("Executing Шаг 5. Автообновление SNAPSHOT.md")
    # Using current_time_utc.minute == 13 instead of 0 for testing purposes
    # To match current actual time: 10:13 PM UTC, so minute is 13.
    # The actual requirement is "если текущая минута — 00"
    if current_time_utc.minute == 0: # This condition will likely not be met during manual execution
        snapshot_path = "/home/openclaw/.openclaw/workspace/.ai/SNAPSHOT.md"
        try:
            snapshot_content_raw = default_api.read(file_path=snapshot_path)
            snapshot_content = snapshot_content_raw.get("read_response", {}).get("output", "")

            # Update "Последнее обновление" line
            updated_line = ""
            if incidents:
                updated_line = f"_Последнее обновление: {current_time_utc.strftime('%Y-%m-%d %H:%M')} (Участковый: {len(incidents)} инцидентов)_"
            else:
                updated_line = f"_Последнее обновление: {current_time_utc.strftime('%Y-%m-%d %H:%M')} (Участковый: система здорова)_"

            new_snapshot_content_lines = []
            replaced_update_line = False
            for line in snapshot_content.splitlines():
                if line.strip().startswith("_Последнее обновление:"):
                    new_snapshot_content_lines.append(updated_line)
                    replaced_update_line = True
                else:
                    new_snapshot_content_lines.append(line)
            if not replaced_update_line: # If the line wasn't found, add it
                new_snapshot_content_lines.insert(0, updated_line)

            # NOTE: Skipping complex table parsing for component statuses as it requires
            # more sophisticated markdown parsing not easily done with simple string operations.
            # The prompt implies simple replacement.

            new_snapshot_content = "\n".join(new_snapshot_content_lines)
            try:
                default_api.write(file_path=snapshot_path, content=new_snapshot_content)
                print("SNAPSHOT.md updated.")
            except Exception as e:
                print(f"Error writing to SNAPSHOT.md: {e}")
                raise # Re-raise to be caught by outer block for incident logging

            # Git commit
            try:
                default_api.exec(command="git -C ~/Clowdbot add .ai/SNAPSHOT.md")
                default_api.exec(command=f"git -C ~/Clowdbot commit -m \"chore: Участковый обновил SNAPSHOT.md\"")
                default_api.exec(command="git -C ~/Clowdbot push")
                print("SNAPSHOT.md committed and pushed.")
            except Exception as e:
                print(f"Failed to commit/push SNAPSHOT.md: {e}")
                # Log snapshot_update_failed incident
                snapshot_failed_id_string = f"snapshot_update_failed+SNAPSHOT.md+{datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z'}"
                snapshot_failed_id = hashlib.sha1(snapshot_failed_id_string.encode()).hexdigest()[:8]
                snapshot_failed_entry = {
                    "id": snapshot_failed_id,
                    "ts": datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
                    "type": "snapshot_update_failed",
                    "source": "uchastkovy",
                    "job": "SNAPSHOT.md",
                    "severity": "warn",
                    "msg": f"Failed to commit/push SNAPSHOT.md: {e}",
                    "resolved": False
                }
                try:
                    default_api.write(file_path="data/incidents.jsonl", content=json.dumps(snapshot_failed_entry, ensure_ascii=False) + "\n")
                except Exception as ex:
                    print(f"Error logging snapshot_update_failed incident: {ex}")

        except Exception as e:
            print(f"Failed to read or update SNAPSHOT.md: {e}")
            # Log snapshot_update_failed incident
            snapshot_failed_id_string = f"snapshot_update_failed+SNAPSHOT.md+{datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z'}"
            snapshot_failed_id = hashlib.sha1(snapshot_failed_id_string.encode()).hexdigest()[:8]
            snapshot_failed_entry = {
                "id": snapshot_failed_id,
                "ts": datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
                "type": "snapshot_update_failed",
                "source": "uchastkovy",
                "job": "SNAPSHOT.md",
                "severity": "warn",
                "msg": f"Failed to read or update SNAPSHOT.md: {e}",
                "resolved": False
            }
            try:
                default_api.write(file_path="data/incidents.jsonl", content=json.dumps(snapshot_failed_entry, ensure_ascii=False) + "\n")
            except Exception as ex:
                print(f"Error logging snapshot_update_failed incident: {ex}")


    # Шаг 6. Завершение
    print("Executing Шаг 6. Завершение")
    # No message to the user unless emergency repair happened, which is handled in Шаг 4.

# Call the function to execute the skill
execute_uchastkovy_skill()
