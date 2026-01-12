#!/bin/bash

# JAT (Jomarchy Agent Tools) Installer
# Complete AI-assisted development environment setup
# https://github.com/joewinke/jat

set -e  # Exit on error

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}ERROR: Do not run this script as root${NC}"
    echo "Run as normal user - sudo will be used when needed"
    exit 1
fi

# Check for required dependencies
MISSING_DEPS=""

if ! command -v tmux &> /dev/null; then
    MISSING_DEPS="$MISSING_DEPS tmux"
fi

if ! command -v sqlite3 &> /dev/null; then
    MISSING_DEPS="$MISSING_DEPS sqlite3"
fi

if ! command -v jq &> /dev/null; then
    MISSING_DEPS="$MISSING_DEPS jq"
fi

if [ -n "$MISSING_DEPS" ]; then
    echo -e "${YELLOW}⚠  Missing required dependencies:${NC}$MISSING_DEPS"
    echo ""

    # Detect package manager
    PKG_MANAGER=""
    INSTALL_CMD=""

    if command -v pacman &> /dev/null; then
        PKG_MANAGER="pacman"
        INSTALL_CMD="sudo pacman -S --noconfirm$MISSING_DEPS"
    elif command -v apt &> /dev/null; then
        PKG_MANAGER="apt"
        INSTALL_CMD="sudo apt install -y$MISSING_DEPS"
    elif command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
        INSTALL_CMD="sudo dnf install -y$MISSING_DEPS"
    elif command -v brew &> /dev/null; then
        PKG_MANAGER="brew"
        INSTALL_CMD="brew install$MISSING_DEPS"
    fi

    if [ -n "$PKG_MANAGER" ]; then
        echo -e "${BLUE}Would you like to install them now with $PKG_MANAGER? [Y/n]${NC}"
        read -r response

        if [[ "$response" =~ ^([yY][eE][sS]|[yY]| *)$ ]]; then
            echo -e "${BLUE}Installing dependencies...${NC}"
            if $INSTALL_CMD; then
                echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
                echo ""
            else
                echo -e "${RED}ERROR: Failed to install dependencies${NC}"
                echo "Please install manually and re-run this script"
                exit 1
            fi
        else
            echo -e "${RED}Installation cancelled. Please install dependencies manually:${NC}"
            echo "  $INSTALL_CMD"
            exit 1
        fi
    else
        echo -e "${RED}ERROR: Could not detect package manager${NC}"
        echo ""
        echo "Install dependencies manually:"
        echo "  # Arch/Manjaro: sudo pacman -S$MISSING_DEPS"
        echo "  # Debian/Ubuntu: sudo apt install$MISSING_DEPS"
        echo "  # Fedora: sudo dnf install$MISSING_DEPS"
        echo "  # macOS: brew install$MISSING_DEPS"
        exit 1
    fi
fi

# Determine installation directory
# Priority: JAT_INSTALL_DIR env var > XDG standard > legacy ~/code locations

# Determine installation directory
# Priority: JAT_INSTALL_DIR env var > current dir (if JAT repo) > XDG location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -n "$JAT_INSTALL_DIR" ]; then
    # User specified custom location via environment variable
    INSTALL_DIR="$JAT_INSTALL_DIR"
    echo -e "${BLUE}Using JAT_INSTALL_DIR: $INSTALL_DIR${NC}"
elif [ -f "$SCRIPT_DIR/install.sh" ] && [ -d "$SCRIPT_DIR/tools" ] && [ -d "$SCRIPT_DIR/ide" ]; then
    # Running from a JAT repo (developer mode)
    INSTALL_DIR="$SCRIPT_DIR"
    echo -e "${BLUE}Using current JAT repo: $INSTALL_DIR${NC}"
elif [ -d "${XDG_DATA_HOME:-$HOME/.local/share}/jat" ]; then
    # Existing XDG installation
    INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/jat"
    echo -e "${BLUE}Using existing installation: $INSTALL_DIR${NC}"
else
    # New installation - clone to XDG location
    INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/jat"
    echo -e "${BLUE}Installing to: $INSTALL_DIR${NC}"
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone https://github.com/joewinke/jat.git "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

echo ""
echo -e "${BOLD}╔───────────────────────────────────────────╗${NC}"
echo -e "${BOLD}│                                           │${NC}"
echo -e "${BOLD}│           __       ___   .___________.    │${NC}"
echo -e "${BOLD}│          |  |     /   \\  |           |    │${NC}"
echo -e "${BOLD}│          |  |    /  ^  \\ \`---|  |----\`    │${NC}"
echo -e "${BOLD}│    .--.  |  |   /  /_\\  \\    |  |         │${NC}"
echo -e "${BOLD}│    |  \`--'  |  /  _____  \\   |  |         │${NC}"
echo -e "${BOLD}│     \\______/  /__/     \\__\\  |__|         │${NC}"
echo -e "${BOLD}│                                           │${NC}"
echo -e "${BOLD}│         ${BLUE}◇ Supervise the Swarm ◇${NC}${BOLD}           │${NC}"
echo -e "${BOLD}│                                           │${NC}"
echo -e "${BOLD}╚───────────────────────────────────────────╝${NC}"
echo ""
echo "Complete AI-assisted development environment:"
echo ""
echo "  • Agent Mail (15 bash/SQLite coordination tools)"
echo "  • Beads CLI (dependency-aware task planning)"
echo "  • 48 bash tools (am-*, browser-*, db-*, media-*, etc.)"
echo "  • Multi-line statusline (agent, task, git, context)"
echo "  • Real-time hooks (auto-refresh statusline)"
echo "  • Optional tech stack tools (SvelteKit + Supabase, etc.)"
echo "  • Global ~/.claude/CLAUDE.md configuration"
echo "  • Per-repository setup (bd init, CLAUDE.md templates)"
echo ""
echo "This will save 32,000+ tokens vs MCP servers!"
echo ""
echo -e "${YELLOW}Press ENTER to continue or Ctrl+C to cancel${NC}"
read

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 1/9: Installing Agent Mail (bash + SQLite)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

bash "$INSTALL_DIR/tools/scripts/install-agent-mail.sh"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 2/9: Installing Beads CLI${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

bash "$INSTALL_DIR/tools/scripts/install-beads.sh"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 3/9: Symlinking Generic Tools${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

bash "$INSTALL_DIR/tools/scripts/symlink-tools.sh"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 4/9: Installing Node.js Dependencies${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if npm is available
if command -v npm &> /dev/null; then
    # Install root jat dependencies (better-sqlite3 for lib/beads.js)
    if [ -f "$INSTALL_DIR/package.json" ]; then
        echo "  → Installing jat core dependencies..."
        (cd "$INSTALL_DIR" && npm install --silent 2>/dev/null) && \
            echo -e "  ${GREEN}✓${NC} jat core dependencies installed" || \
            echo -e "  ${YELLOW}⚠${NC} jat npm install failed (run manually: cd ~/code/jat && npm install)"
    fi

    # Install browser-tools dependencies (puppeteer-core, cheerio)
    if [ -f "$INSTALL_DIR/tools/browser/package.json" ]; then
        echo "  → Installing browser-tools dependencies..."
        (cd "$INSTALL_DIR/tools/browser" && npm install --silent 2>/dev/null) && \
            echo -e "  ${GREEN}✓${NC} browser-tools dependencies installed" || \
            echo -e "  ${YELLOW}⚠${NC} browser-tools npm install failed (run manually: cd tools/browser && npm install)"
    fi

    # Install IDE dependencies (SvelteKit, etc.)
    if [ -f "$INSTALL_DIR/ide/package.json" ]; then
        echo "  → Installing IDE dependencies..."
        (cd "$INSTALL_DIR/ide" && npm install --legacy-peer-deps --engine-strict=false --silent 2>/dev/null) && \
            echo -e "  ${GREEN}✓${NC} IDE dependencies installed" || \
            echo -e "  ${YELLOW}⚠${NC} IDE npm install failed (run manually: cd ide && npm install --legacy-peer-deps)"
    fi
else
    echo -e "${YELLOW}  ⚠ npm not found - skipping Node.js dependencies${NC}"
    echo "  Install Node.js/npm, then run manually:"
    echo "    cd $INSTALL_DIR && npm install"
    echo "    cd $INSTALL_DIR/tools/browser && npm install"
    echo "    cd $INSTALL_DIR/ide && npm install"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 5/9: Statusline & Hooks Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

bash "$INSTALL_DIR/tools/scripts/setup-statusline-and-hooks.sh" "$INSTALL_DIR"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 6/9: Tmux Mouse Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

bash "$INSTALL_DIR/tools/scripts/setup-tmux.sh"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 7/9: Optional Tech Stack Tools${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Ask about optional tech stacks
SELECTED_STACKS=""
echo "Optional tech stack tools available:"
echo "  • SvelteKit + Supabase (11 tools: component-deps, route-list, error-log, etc.)"
echo ""

if command -v gum &> /dev/null; then
    SELECTED_STACKS=$(gum choose --no-limit \
        "SvelteKit + Supabase" \
        "Skip - No additional stacks")
else
    echo -n "Install SvelteKit + Supabase tools? [y/N] "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        SELECTED_STACKS="SvelteKit"
    fi
fi

if echo "$SELECTED_STACKS" | grep -q "SvelteKit"; then
    echo ""
    echo "Installing SvelteKit + Supabase stack..."
    bash "$INSTALL_DIR/stacks/sveltekit-supabase/install.sh"
else
    echo ""
    echo "Skipping stack installation"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 8/9: Voice-to-Text (Optional)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Ask about Voice-to-Text
INSTALL_WHISPER="no"
echo "Voice-to-Text enables speech input in the IDE."
echo "Requires: ~2GB disk, cmake, g++, ffmpeg"
echo ""
if command -v gum &> /dev/null; then
    if gum confirm "Install Voice-to-Text (whisper.cpp)?"; then
        INSTALL_WHISPER="yes"
    fi
else
    echo -n "Install Voice-to-Text (whisper.cpp)? [y/N] "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        INSTALL_WHISPER="yes"
    fi
fi

if [ "$INSTALL_WHISPER" = "yes" ]; then
    bash "$INSTALL_DIR/tools/scripts/install-whisper.sh"
else
    echo ""
    echo "  Skipping Voice-to-Text installation"
    echo "  Run later with: bash $INSTALL_DIR/tools/scripts/install-whisper.sh"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 9/9: Setting Up Global Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

bash "$INSTALL_DIR/tools/scripts/setup-global-claude-md.sh"

echo ""
echo ""
echo -e "${GREEN}╔───────────────────────────────────────────╗${NC}"
echo -e "${GREEN}│                                           │${NC}"
echo -e "${GREEN}│      ${BOLD}✓ JAT Successfully Installed!${NC}${GREEN}        │${NC}"
echo -e "${GREEN}│                                           │${NC}"
echo -e "${GREEN}╚───────────────────────────────────────────╝${NC}"
echo ""
echo "What was installed:"
echo ""
echo "  ✓ Agent Mail (14 bash/SQLite tools: am-register, am-send, am-inbox, etc.)"
echo "  ✓ Beads CLI (bd command + 4 review tools)"
echo "  ✓ Browser Tools (12 CDP automation tools: browser-*.js)"
echo "  ✓ Database Tools (4 tools: db-query, db-schema, etc.)"
echo "  ✓ Signal Tools (2 tools: jat-signal, jat-signal-validate)"
if [ ! -z "$SELECTED_STACKS" ] && echo "$SELECTED_STACKS" | grep -q "SvelteKit"; then
    echo "  ✓ SvelteKit + Supabase Stack (11 additional tools)"
fi
if [ "$INSTALL_WHISPER" = "yes" ]; then
    echo "  ✓ Voice-to-Text (whisper.cpp + large-v3-turbo model)"
fi
echo "  ✓ Multi-line statusline (agent, task, git, context)"
echo "  ✓ Real-time hooks (auto-refresh on am-*/bd commands)"
echo "  ✓ Git pre-commit hook (agent registration check)"
echo "  ✓ Global ~/.claude/CLAUDE.md (multi-project instructions)"
echo "  ✓ Per-repo setup (bd init, CLAUDE.md templates)"
echo ""
# Detect shell config file
SHELL_NAME=$(basename "$SHELL")
if [[ "$SHELL_NAME" == "zsh" ]]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [[ "$SHELL_NAME" == "bash" ]]; then
    SHELL_CONFIG="$HOME/.bashrc"
else
    SHELL_CONFIG="$HOME/.bashrc"
fi

# Ensure ~/.local/bin is in PATH
if ! grep -q '\.local/bin' "$SHELL_CONFIG" 2>/dev/null; then
    echo "" >> "$SHELL_CONFIG"
    echo '# JAT tools' >> "$SHELL_CONFIG"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_CONFIG"
    echo -e "  ${GREEN}✓${NC} Added ~/.local/bin to PATH in $SHELL_CONFIG"
fi

echo ""
echo "The IDE will guide you through adding your first project."
echo ""
echo "Documentation: https://github.com/joewinke/jat"
echo ""
echo -e -n "${BOLD}Launch JAT now? [Y/n]${NC} "
read -r response
if [[ ! "$response" =~ ^[Nn]$ ]]; then
    echo ""
    exec "$HOME/.local/bin/jat"
fi
echo ""
