#!/bin/bash
# Pre-compact hook: Save current agent identity before compaction
# This ensures we can restore the agent after context is compacted
#
# Uses WINDOWID-based file - stable across /clear (unlike PPID which changes)
# Each terminal window has unique WINDOWID, avoiding race conditions

PROJECT_DIR="$(pwd)"
CLAUDE_DIR="$PROJECT_DIR/.claude"

# Use WINDOWID for persistence (stable across /clear, unique per terminal)
# Falls back to PPID if WINDOWID not available
WINDOW_KEY="${WINDOWID:-$PPID}"
PERSISTENT_AGENT_FILE="$CLAUDE_DIR/.agent-identity-${WINDOW_KEY}"

# Find the current session's agent file
SESSION_ID=$(cat /tmp/claude-session-${PPID}.txt 2>/dev/null | tr -d '\n')
# Use sessions/ subdirectory to keep .claude/ clean
AGENT_FILE="$CLAUDE_DIR/sessions/agent-${SESSION_ID}.txt"

if [[ -f "$AGENT_FILE" ]]; then
    AGENT_NAME=$(cat "$AGENT_FILE" | tr -d '\n')

    # Save to window-specific location (no race condition with other agents)
    echo "$AGENT_NAME" > "$PERSISTENT_AGENT_FILE"

    # Output marker for dashboard state detection
    # This tells the dashboard we're compacting (not idle/waiting for review)
    echo "[JAT:COMPACTING]"

    # Log for debugging
    echo "[PreCompact] Saved agent identity: $AGENT_NAME (WINDOWID=$WINDOW_KEY)" >> "$CLAUDE_DIR/.agent-activity.log"
fi
