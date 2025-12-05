#!/usr/bin/env bash
#
# pre-ask-user-question.sh - Claude PreToolUse hook for AskUserQuestion
#
# This hook captures the question data BEFORE the user answers,
# writing it to a temp file for the dashboard to display.
#
# PreToolUse is required because PostToolUse runs after the user
# has already answered, making the question data irrelevant.

set -euo pipefail

# Read tool info from stdin
TOOL_INFO=$(cat)

# Extract session ID from hook data
SESSION_ID=$(echo "$TOOL_INFO" | jq -r '.session_id // ""' 2>/dev/null || echo "")

if [[ -z "$SESSION_ID" ]]; then
    exit 0  # Can't determine session, skip
fi

# Get tmux session name - try multiple methods
TMUX_SESSION=""
# Method 1: From TMUX env var (may not be passed to hook subprocess)
if [[ -n "${TMUX:-}" ]]; then
    TMUX_SESSION=$(tmux display-message -p '#S' 2>/dev/null || echo "")
fi
# Method 2: From agent session file (more reliable)
if [[ -z "$TMUX_SESSION" ]]; then
    # Try multiple possible locations for agent file
    for BASE_DIR in "." "/home/jw/code/jat" "/home/jw/code/chimaro" "/home/jw/code/jomarchy"; do
        AGENT_FILE="${BASE_DIR}/.claude/agent-${SESSION_ID}.txt"
        if [[ -f "$AGENT_FILE" ]]; then
            AGENT_NAME=$(cat "$AGENT_FILE" 2>/dev/null | tr -d '\n')
            if [[ -n "$AGENT_NAME" ]]; then
                TMUX_SESSION="jat-${AGENT_NAME}"
                break
            fi
        fi
    done
fi

# Build question data JSON
QUESTION_DATA=$(echo "$TOOL_INFO" | jq -c --arg tmux "$TMUX_SESSION" '{
    session_id: .session_id,
    tmux_session: $tmux,
    timestamp: (now | todate),
    questions: .tool_input.questions
}' 2>/dev/null || echo "{}")

# Write to session ID file
QUESTION_FILE="/tmp/claude-question-${SESSION_ID}.json"
echo "$QUESTION_DATA" > "$QUESTION_FILE" 2>/dev/null || true

# Also write to tmux session name file for easy dashboard lookup
if [[ -n "$TMUX_SESSION" ]]; then
    TMUX_QUESTION_FILE="/tmp/claude-question-tmux-${TMUX_SESSION}.json"
    echo "$QUESTION_DATA" > "$TMUX_QUESTION_FILE" 2>/dev/null || true
fi

exit 0
