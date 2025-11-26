#!/bin/bash

# Setup Global Claude Configuration
# - Installs agent coordination commands to ~/.claude/commands/agent/
# - No longer writes to ~/.claude/CLAUDE.md (imports handled per-project)

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Setting up global Claude Code configuration...${NC}"
echo ""

# Ensure ~/.claude directory exists
mkdir -p ~/.claude
mkdir -p ~/.claude/commands/agent

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
COMMANDS_SOURCE="$SCRIPT_DIR/../commands/agent"

# Install agent coordination commands
if [ -d "$COMMANDS_SOURCE" ]; then
    echo "  → Installing agent coordination commands..."
    COMMAND_COUNT=$(find "$COMMANDS_SOURCE" -name "*.md" -type f | wc -l)
    cp -r "$COMMANDS_SOURCE"/*.md ~/.claude/commands/agent/ 2>/dev/null || true
    echo -e "${GREEN}  ✓ Installed $COMMAND_COUNT coordination commands${NC}"
    echo "    Location: ~/.claude/commands/agent/"
    echo ""
fi

echo -e "${GREEN}  ✓ Global configuration complete${NC}"
echo ""
echo "  Agent commands available via /agent:* namespace"
echo "  Project-specific docs are imported via @~/code/jat/shared/*.md"
echo ""
