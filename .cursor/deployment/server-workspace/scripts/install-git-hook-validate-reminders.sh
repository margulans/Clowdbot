#!/usr/bin/env bash
set -euo pipefail

# Installs a local pre-push hook to prevent pushing reminder-breaking cron snapshots.
# Safe: modifies only .git/hooks in the local clone.

REPO_DIR="${1:-$HOME/Clowdbot}"
HOOK="$REPO_DIR/.git/hooks/pre-push"

mkdir -p "$(dirname "$HOOK")"
cat > "$HOOK" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
python3 .cursor/deployment/server-workspace/scripts/validate-cron-reminders.py
EOF
chmod +x "$HOOK"

echo "Installed pre-push hook: $HOOK"
