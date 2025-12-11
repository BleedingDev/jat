#!/usr/bin/env bash
#
# post-bash-jat-signal.sh - PostToolUse hook for jat-signal commands
#
# Detects when agent runs jat-signal and writes structured data to temp file
# for dashboard consumption via SSE.
#
# Signal format: [JAT-SIGNAL:<type>] <json-payload>
# Types: working, review, needs_input, idle, completing, completed,
#        starting, compacting, auto_proceed, tasks, action, complete
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
OUTPUT=$(echo "$TOOL_INFO" | jq -r '.tool_response.stdout // ""' 2>/dev/null || echo "")

# Check for validation warnings in stderr
STDERR=$(echo "$TOOL_INFO" | jq -r '.tool_response.stderr // ""' 2>/dev/null || echo "")
VALIDATION_WARNING=""
if echo "$STDERR" | grep -q 'Warning:'; then
    VALIDATION_WARNING=$(echo "$STDERR" | grep -o 'Warning: .*' | head -1)
fi

# Parse the signal from output - format: [JAT-SIGNAL:<type>] <json>
SIGNAL_TYPE=""
SIGNAL_DATA=""

if echo "$OUTPUT" | grep -qE '\[JAT-SIGNAL:[a-z_]+\]'; then
    # Extract signal type from marker
    SIGNAL_TYPE=$(echo "$OUTPUT" | grep -oE '\[JAT-SIGNAL:[a-z_]+\]' | head -1 | sed 's/\[JAT-SIGNAL://;s/\]//')
    # Extract JSON payload after marker
    SIGNAL_DATA=$(echo "$OUTPUT" | sed -n 's/.*\[JAT-SIGNAL:[a-z_]*\] *//p')
fi

if [[ -z "$SIGNAL_TYPE" ]]; then
    exit 0
fi

# Get tmux session name for dashboard lookup
TMUX_SESSION=""

# Build list of directories to search: current dir + configured projects
SEARCH_DIRS="."
JAT_CONFIG="$HOME/.config/jat/projects.json"
if [[ -f "$JAT_CONFIG" ]]; then
    PROJECT_PATHS=$(jq -r '.projects[].path // empty' "$JAT_CONFIG" 2>/dev/null | sed "s|^~|$HOME|g")
    for PROJECT_PATH in $PROJECT_PATHS; do
        if [[ -d "${PROJECT_PATH}/.claude" ]]; then
            SEARCH_DIRS="$SEARCH_DIRS $PROJECT_PATH"
        fi
    done
fi

for BASE_DIR in $SEARCH_DIRS; do
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

# Parse signal data as JSON
PARSED_DATA=$(echo "${SIGNAL_DATA:-{}}" | jq -c . 2>/dev/null || echo '{}')

# Extract task_id from payload if present
TASK_ID=$(echo "$PARSED_DATA" | jq -r '.taskId // ""' 2>/dev/null || echo "")

# Build signal JSON
SIGNAL_JSON=$(jq -c -n \
    --arg type "$SIGNAL_TYPE" \
    --arg session "$SESSION_ID" \
    --arg tmux "$TMUX_SESSION" \
    --arg task "$TASK_ID" \
    --argjson data "$PARSED_DATA" \
    --arg warning "${VALIDATION_WARNING:-}" \
    '{
        type: $type,
        session_id: $session,
        tmux_session: $tmux,
        timestamp: (now | todate),
        data: $data
    } + (if $task != "" then {task_id: $task} else {} end)
      + (if $warning != "" then {validation_warning: $warning} else {} end)' 2>/dev/null || echo "{}")

# Get current git SHA for rollback capability
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "")

# Add git_sha to signal JSON if available
if [[ -n "$GIT_SHA" ]]; then
    SIGNAL_JSON=$(echo "$SIGNAL_JSON" | jq -c --arg sha "$GIT_SHA" '. + {git_sha: $sha}' 2>/dev/null || echo "$SIGNAL_JSON")
fi

# Write to temp file by session ID (current state - overwrites)
SIGNAL_FILE="/tmp/jat-signal-${SESSION_ID}.json"
echo "$SIGNAL_JSON" > "$SIGNAL_FILE" 2>/dev/null || true

# Also write by tmux session name for easy lookup (current state - overwrites)
if [[ -n "$TMUX_SESSION" ]]; then
    TMUX_SIGNAL_FILE="/tmp/jat-signal-tmux-${TMUX_SESSION}.json"
    echo "$SIGNAL_JSON" > "$TMUX_SIGNAL_FILE" 2>/dev/null || true

    # Append to timeline log (JSONL format - preserves history)
    TIMELINE_FILE="/tmp/jat-timeline-${TMUX_SESSION}.jsonl"
    echo "$SIGNAL_JSON" >> "$TIMELINE_FILE" 2>/dev/null || true
fi

exit 0
