#!/bin/bash
# Session start hook: Restore agent identity after compaction or session resume
# This ensures the agent file exists for the new session ID
#
# Uses WINDOWID-based file - stable across /clear (unlike PPID which changes)
# Each terminal window has unique WINDOWID, avoiding race conditions

PROJECT_DIR="$(pwd)"
CLAUDE_DIR="$PROJECT_DIR/.claude"

# Use WINDOWID for persistence (matches pre-compact hook)
# Falls back to PPID if WINDOWID not available
WINDOW_KEY="${WINDOWID:-$PPID}"
PERSISTENT_AGENT_FILE="$CLAUDE_DIR/.agent-identity-${WINDOW_KEY}"

# Read session ID from stdin JSON (provided by Claude Code)
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)

if [[ -z "$SESSION_ID" ]]; then
    # No session ID - can't do anything
    exit 0
fi

# Also update the PPID-based session file for other tools
echo "$SESSION_ID" > "/tmp/claude-session-${PPID}.txt"

# Use sessions/ subdirectory to keep .claude/ clean
mkdir -p "$CLAUDE_DIR/sessions"
AGENT_FILE="$CLAUDE_DIR/sessions/agent-${SESSION_ID}.txt"

# Track if we restored or already had agent
AGENT_NAME=""

# If agent file already exists for this session, read the name
if [[ -f "$AGENT_FILE" ]]; then
    AGENT_NAME=$(cat "$AGENT_FILE" | tr -d '\n')
fi

# Check if we have a saved agent identity to restore (window-specific)
if [[ -z "$AGENT_NAME" ]] && [[ -f "$PERSISTENT_AGENT_FILE" ]]; then
    AGENT_NAME=$(cat "$PERSISTENT_AGENT_FILE" | tr -d '\n')

    if [[ -n "$AGENT_NAME" ]]; then
        # Restore the agent file for this new session ID
        echo "$AGENT_NAME" > "$AGENT_FILE"

        # Ensure agent is registered in Agent Mail
        if command -v am-register &>/dev/null; then
            # Check if already registered
            if ! sqlite3 ~/.agent-mail.db "SELECT 1 FROM agents WHERE name = '$AGENT_NAME'" 2>/dev/null | grep -q 1; then
                am-register --name "$AGENT_NAME" --program claude-code --model opus-4.5 2>/dev/null
            fi
        fi

        # Log for debugging
        echo "[SessionStart] Restored agent: $AGENT_NAME for session $SESSION_ID (WINDOWID=$WINDOW_KEY)" >> "$CLAUDE_DIR/.agent-activity.log"
    fi
fi

# Output working marker if agent has an in_progress task
# This re-establishes dashboard state after compaction
if [[ -n "$AGENT_NAME" ]] && command -v bd &>/dev/null; then
    TASK_ID=$(bd list --json 2>/dev/null | jq -r --arg a "$AGENT_NAME" '.[] | select(.assignee == $a and .status == "in_progress") | .id' 2>/dev/null | head -1)
    if [[ -n "$TASK_ID" ]]; then
        echo "[JAT:WORKING task=$TASK_ID]"
        echo "[SessionStart] Re-established working state for task $TASK_ID" >> "$CLAUDE_DIR/.agent-activity.log"
    fi
fi
