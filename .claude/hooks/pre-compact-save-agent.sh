#!/bin/bash
# Pre-compact hook: Save current agent identity, workflow state, and terminal scrollback before compaction
# This ensures we can restore identity, workflow context, AND terminal history after compaction
#
# Uses WINDOWID-based file - stable across /clear (unlike PPID which changes)
# Each terminal window has unique WINDOWID, avoiding race conditions

PROJECT_DIR="$(pwd)"
CLAUDE_DIR="$PROJECT_DIR/.claude"
BEADS_LOGS_DIR="$PROJECT_DIR/.beads/logs"

# Use WINDOWID for persistence (stable across /clear, unique per terminal)
# Falls back to PPID if WINDOWID not available
WINDOW_KEY="${WINDOWID:-$PPID}"
PERSISTENT_AGENT_FILE="$CLAUDE_DIR/.agent-identity-${WINDOW_KEY}"
PERSISTENT_STATE_FILE="$CLAUDE_DIR/.agent-workflow-state-${WINDOW_KEY}.json"

# Find the current session's agent file
SESSION_ID=$(cat /tmp/claude-session-${PPID}.txt 2>/dev/null | tr -d '\n')
# Use sessions/ subdirectory to keep .claude/ clean
AGENT_FILE="$CLAUDE_DIR/sessions/agent-${SESSION_ID}.txt"

# Get tmux session name for signal file lookup and scrollback capture
TMUX_SESSION=""
if [[ -n "${TMUX:-}" ]]; then
    TMUX_SESSION=$(tmux display-message -p '#S' 2>/dev/null)
fi

# ============================================================================
# CAPTURE TERMINAL SCROLLBACK BEFORE COMPACTION
# This preserves the pre-compaction terminal history that would otherwise be lost
# ============================================================================
if [[ -n "$TMUX_SESSION" ]]; then
    # Ensure logs directory exists
    mkdir -p "$BEADS_LOGS_DIR" 2>/dev/null

    # Generate timestamp for filename
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)

    # Capture full scrollback from tmux
    # -p: print to stdout, -S -: start from beginning of scrollback, -E -: end at bottom
    SCROLLBACK_FILE="$BEADS_LOGS_DIR/scrollback-pre-compact-${TMUX_SESSION}-${TIMESTAMP}.log"

    if tmux capture-pane -t "$TMUX_SESSION" -p -S - -E - > "$SCROLLBACK_FILE" 2>/dev/null; then
        # Only keep the file if it has content
        if [[ -s "$SCROLLBACK_FILE" ]]; then
            # Add header with metadata
            TEMP_FILE=$(mktemp)
            cat > "$TEMP_FILE" << HEADER
# Pre-Compaction Scrollback Capture
# Session: $TMUX_SESSION
# Captured: $(date -Iseconds)
# Reason: Context compaction about to clear terminal history
================================================================================

HEADER
            cat "$SCROLLBACK_FILE" >> "$TEMP_FILE"
            mv "$TEMP_FILE" "$SCROLLBACK_FILE"

            echo "[PreCompact] Saved scrollback to: $SCROLLBACK_FILE" >> "$CLAUDE_DIR/.agent-activity.log"
        else
            # Remove empty file
            rm -f "$SCROLLBACK_FILE" 2>/dev/null
        fi
    fi
fi

if [[ -f "$AGENT_FILE" ]]; then
    AGENT_NAME=$(cat "$AGENT_FILE" | tr -d '\n')

    # Save agent name to window-specific location
    echo "$AGENT_NAME" > "$PERSISTENT_AGENT_FILE"

    # Build workflow state JSON
    SIGNAL_STATE="unknown"
    TASK_ID=""
    TASK_TITLE=""

    # Try to get last signal state from signal file
    SIGNAL_FILE="/tmp/jat-signal-tmux-${TMUX_SESSION}.json"
    if [[ -f "$SIGNAL_FILE" ]]; then
        # Signal file may have .state or .signalType depending on source
        SIGNAL_STATE=$(jq -r '.state // .signalType // .type // "unknown"' "$SIGNAL_FILE" 2>/dev/null)
        # Task ID may be in .task_id or .data.taskId
        TASK_ID=$(jq -r '.task_id // .data.taskId // .taskId // ""' "$SIGNAL_FILE" 2>/dev/null)
        TASK_TITLE=$(jq -r '.data.taskTitle // .taskTitle // ""' "$SIGNAL_FILE" 2>/dev/null)
    fi

    # If no signal file, try to get task from Beads
    if [[ -z "$TASK_ID" ]] && command -v bd &>/dev/null; then
        TASK_ID=$(bd list --json 2>/dev/null | jq -r --arg a "$AGENT_NAME" '.[] | select(.assignee == $a and .status == "in_progress") | .id' 2>/dev/null | head -1)
        if [[ -n "$TASK_ID" ]]; then
            TASK_TITLE=$(bd show "$TASK_ID" --json 2>/dev/null | jq -r '.[0].title // ""' 2>/dev/null)
        fi
    fi

    # Save workflow state
    cat > "$PERSISTENT_STATE_FILE" << EOF
{
  "agentName": "$AGENT_NAME",
  "signalState": "$SIGNAL_STATE",
  "taskId": "$TASK_ID",
  "taskTitle": "$TASK_TITLE",
  "savedAt": "$(date -Iseconds)"
}
EOF

    # Output marker for IDE state detection
    echo "[JAT:COMPACTING]"

    # Log for debugging
    echo "[PreCompact] Saved agent: $AGENT_NAME, state: $SIGNAL_STATE, task: $TASK_ID (WINDOWID=$WINDOW_KEY)" >> "$CLAUDE_DIR/.agent-activity.log"
fi
