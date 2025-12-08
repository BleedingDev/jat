#!/usr/bin/env bash
#
# post-bash-jat-signal.sh - PostToolUse hook for jat-signal commands
#
# Detects when agent runs jat-signal and writes structured data to temp file
# for dashboard consumption. This enables hook-based signal delivery instead
# of terminal marker parsing.
#
# Input: JSON with tool name, input (command), output, session_id
# Output: Writes to /tmp/jat-signal-{session}.json

set -euo pipefail

# Read tool info from stdin
TOOL_INFO=$(cat)

# Only process Bash tool calls
TOOL_NAME=$(echo "$TOOL_INFO" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
if [[ "$TOOL_NAME" != "Bash" ]]; then
    exit 0
fi

# Extract the command that was executed
COMMAND=$(echo "$TOOL_INFO" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Check if it's a jat-signal command
if ! echo "$COMMAND" | grep -q '^jat-signal '; then
    exit 0
fi

# Extract session ID
SESSION_ID=$(echo "$TOOL_INFO" | jq -r '.session_id // ""' 2>/dev/null || echo "")
if [[ -z "$SESSION_ID" ]]; then
    exit 0
fi

# Extract the tool output (contains [JAT-SIGNAL:...] marker)
# Note: PostToolUse hooks receive tool_response.stdout, not .output
OUTPUT=$(echo "$TOOL_INFO" | jq -r '.tool_response.stdout // ""' 2>/dev/null || echo "")

# Parse the signal from output
SIGNAL_TYPE=""
SIGNAL_DATA=""
TASK_ID=""

if echo "$OUTPUT" | grep -q '\[JAT-SIGNAL:COMPLETE\]'; then
    SIGNAL_TYPE="complete"
    SIGNAL_DATA=$(echo "$OUTPUT" | sed -n 's/.*\[JAT-SIGNAL:COMPLETE\] *//p')
elif echo "$OUTPUT" | grep -q '\[JAT-SIGNAL:STATE\]'; then
    SIGNAL_TYPE="state"
    RAW_STATE=$(echo "$OUTPUT" | sed -n 's/.*\[JAT-SIGNAL:STATE\] *//p')
    # Handle working:task-id format
    if echo "$RAW_STATE" | grep -q '^working:'; then
        SIGNAL_DATA="working"
        TASK_ID=$(echo "$RAW_STATE" | sed 's/^working://')
    else
        SIGNAL_DATA="$RAW_STATE"
    fi
elif echo "$OUTPUT" | grep -q '\[JAT-SIGNAL:TASKS\]'; then
    SIGNAL_TYPE="tasks"
    SIGNAL_DATA=$(echo "$OUTPUT" | sed -n 's/.*\[JAT-SIGNAL:TASKS\] *//p')
elif echo "$OUTPUT" | grep -q '\[JAT-SIGNAL:ACTION\]'; then
    SIGNAL_TYPE="action"
    SIGNAL_DATA=$(echo "$OUTPUT" | sed -n 's/.*\[JAT-SIGNAL:ACTION\] *//p')
fi

if [[ -z "$SIGNAL_TYPE" ]]; then
    exit 0
fi

# Get tmux session name for dashboard lookup
TMUX_SESSION=""
for BASE_DIR in "." "/home/jw/code/jat" "/home/jw/code/chimaro" "/home/jw/code/jomarchy"; do
    for SUBDIR in "sessions" ""; do
        if [[ -n "$SUBDIR" ]]; then
            AGENT_FILE="${BASE_DIR}/.claude/${SUBDIR}/agent-${SESSION_ID}.txt"
        else
            AGENT_FILE="${BASE_DIR}/.claude/agent-${SESSION_ID}.txt"
        fi
        if [[ -f "$AGENT_FILE" ]]; then
            AGENT_NAME=$(cat "$AGENT_FILE" 2>/dev/null | tr -d '\n')
            if [[ -n "$AGENT_NAME" ]]; then
                TMUX_SESSION="jat-${AGENT_NAME}"
                break 2
            fi
        fi
    done
done

# Build signal JSON
# For state signals, data is a string; for others, try to parse as JSON
if [[ "$SIGNAL_TYPE" == "state" ]]; then
    # State signal: data is a string like "working", "review", etc.
    SIGNAL_JSON=$(jq -n \
        --arg type "$SIGNAL_TYPE" \
        --arg session "$SESSION_ID" \
        --arg tmux "$TMUX_SESSION" \
        --arg state "${SIGNAL_DATA:-idle}" \
        --arg task "${TASK_ID:-}" \
        '{
            type: $type,
            session_id: $session,
            tmux_session: $tmux,
            timestamp: (now | todate),
            state: $state
        } + (if $task != "" then {task_id: $task} else {} end)' 2>/dev/null || echo "{}")
else
    # Data signals: try to parse data as JSON
    SIGNAL_JSON=$(jq -n \
        --arg type "$SIGNAL_TYPE" \
        --arg session "$SESSION_ID" \
        --arg tmux "$TMUX_SESSION" \
        --argjson data "$(echo "${SIGNAL_DATA:-null}" | jq . 2>/dev/null || echo 'null')" \
        '{
            type: $type,
            session_id: $session,
            tmux_session: $tmux,
            timestamp: (now | todate),
            data: $data
        }' 2>/dev/null || echo "{}")
fi

# Write to temp file by session ID
SIGNAL_FILE="/tmp/jat-signal-${SESSION_ID}.json"
echo "$SIGNAL_JSON" > "$SIGNAL_FILE" 2>/dev/null || true

# Also write by tmux session name for easy lookup
if [[ -n "$TMUX_SESSION" ]]; then
    TMUX_SIGNAL_FILE="/tmp/jat-signal-tmux-${TMUX_SESSION}.json"
    echo "$SIGNAL_JSON" > "$TMUX_SIGNAL_FILE" 2>/dev/null || true
fi

# Log for debugging (optional, can be removed)
# echo "JAT Signal: $SIGNAL_TYPE -> $SIGNAL_FILE" >&2

exit 0
