#!/bin/bash
#
# Claude Code statusline for jomarchy-agent-tools
# Shows: Agent Name | Current Task ID - Task Title
#

# ANSI color codes
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
RESET='\033[0m'
BOLD='\033[1m'

# Read JSON from stdin (provided by Claude Code)
json_input=$(cat)

# Get current working directory from JSON
cwd=$(echo "$json_input" | jq -r '.cwd // empty')

# Get agent name
agent_name=""

# First check AGENT_NAME environment variable
if [[ -n "$AGENT_NAME" ]]; then
    agent_name="$AGENT_NAME"
elif command -v am-agents &>/dev/null; then
    # Get most recently active agent for this project
    agent_name=$(am-agents 2>/dev/null | grep -A 4 "^  [A-Z]" | head -5 | grep "^  " | awk '{print $1}' | head -1 || echo "")
fi

# If no agent name, show generic status
if [[ -z "$agent_name" ]]; then
    echo -e "${GRAY}jomarchy-agent-tools${RESET} | ${CYAN}no agent registered${RESET}"
    exit 0
fi

# Get current task from file reservations
task_id=""
task_title=""

if command -v am-reservations &>/dev/null; then
    # Get the most recent reservation for this agent and extract task ID from reason
    reservation_info=$(am-reservations --agent "$agent_name" 2>/dev/null)

    if [[ -n "$reservation_info" ]]; then
        # Extract task ID from reason field (format: "task-id: description" or just "task-id")
        task_id=$(echo "$reservation_info" | grep "^Reason:" | sed 's/^Reason: //' | grep -oE 'jomarchy-agent-tools-[a-z0-9]+' | head -1)
    fi
fi

# If we have a task ID, get the task title from Beads
if [[ -n "$task_id" ]] && command -v bd &>/dev/null; then
    # Change to project directory if provided
    if [[ -n "$cwd" ]] && [[ -d "$cwd" ]]; then
        cd "$cwd" 2>/dev/null || true
    fi

    task_title=$(bd show "$task_id" --json 2>/dev/null | jq -r '.[0].title // empty')

    # Truncate title if too long
    if [[ ${#task_title} -gt 50 ]]; then
        task_title="${task_title:0:47}..."
    fi
fi

# Build status line
if [[ -n "$task_id" ]]; then
    # Working on a task
    if [[ -n "$task_title" ]]; then
        # Task with title
        echo -e "${BOLD}${BLUE}$agent_name${RESET} ${GRAY}|${RESET} ${GREEN}$task_id${RESET} ${GRAY}-${RESET} ${YELLOW}$task_title${RESET}"
    else
        # Task without title (not found in Beads)
        echo -e "${BOLD}${BLUE}$agent_name${RESET} ${GRAY}|${RESET} ${GREEN}$task_id${RESET}"
    fi
elif [[ -n "$agent_name" ]]; then
    # Agent registered but no active task
    echo -e "${BOLD}${BLUE}$agent_name${RESET} ${GRAY}|${RESET} ${CYAN}idle${RESET}"
else
    # Fallback
    echo -e "${GRAY}jomarchy-agent-tools${RESET}"
fi
