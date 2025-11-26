# Jomarchy Agent Tools

Lightweight bash tools for agent orchestration, database operations, monitoring, development, and browser automation.

@~/code/jat/shared/overview.md
@~/code/jat/shared/agent-mail.md
@~/code/jat/shared/bash-patterns.md
@~/code/jat/shared/beads.md
@~/code/jat/shared/tools.md
@~/code/jat/shared/workflow-commands.md
@~/code/jat/shared/statusline.md

## Project Structure

```
jat/
├── mail/                # Agent Mail coordination system (11 tools)
├── commands/jat/        # JAT workflow commands (9 commands)
├── browser-tools/       # Browser automation tools (11 tools)
├── tools/               # Database & monitoring tools (6 tools)
├── dashboard/           # Beads Task Dashboard (SvelteKit app)
├── scripts/             # Installation and setup scripts
├── shared/              # Shared documentation (imported by projects)
└── install.sh           # Installation script
```

## Quick Start

```bash
# Install tools (symlinks to ~/bin/)
./install.sh

# Verify installation
am-whoami
db-schema
browser-start.js --help

# Start working (registers agent + picks task)
/jat:start
```

## Dashboard Development

**The Beads Task Dashboard is a SvelteKit 5 application in the `dashboard/` directory.**

### Important: Dashboard-Specific Documentation

When working on the dashboard, refer to:
```
dashboard/CLAUDE.md
```

This contains critical information about:
- **Tailwind CSS v4 syntax** (completely different from v3!)
- DaisyUI theme configuration
- Theme switching implementation
- Svelte 5 runes syntax
- Common pitfalls and troubleshooting

### Quick Dashboard Commands

**Launcher Script (Recommended):**
```bash
bd-dashboard        # Checks dependencies, starts server, opens browser
jat-dashboard       # Alias for bd-dashboard
```

**Manual Commands:**
```bash
cd dashboard
npm install
npm run dev         # Usually http://127.0.0.1:5174

# Clean build cache if themes aren't loading
rm -rf .svelte-kit node_modules/.vite
npm run dev
```

### Critical Dashboard Issue: Tailwind v4

**This does NOT work (v3 syntax):**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**You MUST use this (v4 syntax):**
```css
@import "tailwindcss";

@plugin "daisyui" {
  themes: light, dark, nord --default, ...;
}
```

See `dashboard/CLAUDE.md` for full details.

## Common Issues

### Dashboard themes not working
1. Check `dashboard/src/app.css` uses Tailwind v4 syntax
2. See `dashboard/CLAUDE.md` for detailed troubleshooting

### Agent Mail "not registered"
```bash
/jat:start                # Quick fix (auto-registers)
# Or manually:
am-register --name YourAgentName --program claude-code --model sonnet-4.5
```

### Browser tools not found
```bash
cd /home/jw/code/jat
./install.sh
```

### Fresh dashboard build needed
```bash
cd dashboard
rm -rf .svelte-kit node_modules/.vite
npm run dev
```

### Statusline not updating
```bash
# Write to your session file (PPID-based)
session_id=$(cat /tmp/claude-session-${PPID}.txt | tr -d '\n') && echo "YourAgentName" > ".claude/agent-${session_id}.txt"
```

## References

- **Shared docs**: `./shared/*.md` (imported above)
- **Dashboard docs**: `dashboard/CLAUDE.md`
- **JAT commands**: `./commands/jat/*.md`
- **Tool source**: Each tool directory contains implementation
- **Installation**: `install.sh` for symlink setup
