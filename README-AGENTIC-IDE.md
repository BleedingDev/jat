# JAT — The World's First Agentic IDE

**The complete development environment built for AI agent supervision.**

While everyone else is building copilots that help you type faster, we built an IDE that lets you stop typing altogether. Supervise a swarm of AI agents working in parallel across your codebase.

![Dashboard](https://img.shields.io/badge/Dashboard-SvelteKit-orange)
![Agents](https://img.shields.io/badge/Agents-20+-green)
![Tools](https://img.shields.io/badge/Tools-50+-blue)

## The Paradigm Shift

```
Traditional IDE:     You write code, tools assist
Copilot IDE:         You write code, AI suggests completions
Agentic IDE:         Agents write code, you supervise and approve
```

JAT is purpose-built for the third paradigm. It's not about typing faster—it's about managing 20 agents working simultaneously while you review, guide, and approve.

## Complete IDE Feature Set

Every feature a modern IDE needs, reimagined for agent supervision:

| Shortcut | Feature | Description |
|----------|---------|-------------|
| `Cmd+K` | **Global Search** | Fuzzy search across all files, tasks, agents |
| `Cmd+Shift+T` | **Terminal** | Integrated terminal with agent session access |
| `Cmd+S` | **Save** | Save current file (Monaco editor) |
| `Alt+N` | **New Task** | Create task from anywhere |
| `Alt+E` | **Epic Swarm** | Launch parallel agents on epic subtasks |

### The /files Route — A Complete Code Editor

```
┌─────────────────────────────────────────────────────────────────────┐
│  📁 Files  │  🔀 Git                                                │
├─────────────────────────────────────────────────────────────────────┤
│            │                                                        │
│  ▼ src/    │  ┌─────┬─────┬─────┐                                  │
│    ▼ lib/  │  │ a.ts│ b.ts│ c.ts│  ← Multi-file tabs              │
│      api/  │  └─────┴─────┴─────┘                                  │
│      utils │  ┌────────────────────────────────────────────────┐   │
│    routes/ │  │                                                │   │
│  ▼ tests/  │  │  Monaco Editor                                 │   │
│            │  │  • Syntax highlighting                         │   │
│  [+ New]   │  │  • IntelliSense                                │   │
│  [↻ Refresh│  │  • Multi-cursor                                │   │
│            │  │  • 25+ languages                               │   │
│            │  │                                                │   │
│            │  └────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**File Explorer:**
- Lazy-loading directory tree
- Right-click context menu (new file, rename, delete)
- Drag-and-drop tab reordering
- Keyboard navigation (Enter, F2, Delete)
- File type icons (TypeScript, JavaScript, JSON, etc.)
- Persistent tab order across sessions

**Editor:**
- Full Monaco (VS Code's editor engine)
- Syntax highlighting for 25+ languages
- Multi-file tabs with unsaved indicators
- `Ctrl+S` save with visual feedback
- `Alt+W` close tab, `Alt+[`/`Alt+]` switch tabs

### Git Source Control Panel

Switch to the Git tab for VS Code-style source control:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⎇ main  ↑2 ↓0                                        [⟳ Fetch]    │
├─────────────────────────────────────────────────────────────────────┤
│  ▼ STAGED CHANGES (3)                                    [− All]   │
│    M  src/lib/api.ts                                               │
│    A  src/lib/newfile.ts                                           │
│    D  src/lib/oldfile.ts                                           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Commit message...                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                    [✓ Commit]      │
├─────────────────────────────────────────────────────────────────────┤
│  ▼ CHANGES (5)                                           [+ All]   │
│    M  src/routes/+page.svelte                          [+] [↻]    │
│    ?  src/lib/temp.ts                                  [+]        │
├─────────────────────────────────────────────────────────────────────┤
│  [↑ Push]  [↓ Pull]                                                │
├─────────────────────────────────────────────────────────────────────┤
│  ▼ TIMELINE (30)                                                   │
│    ● abc123  2h ago   Add authentication                           │
│    ○ def456  5h ago   Fix login bug                                │
│    ○ ghi789  1d ago   Initial commit                               │
└─────────────────────────────────────────────────────────────────────┘
```

**Git Features:**
- Stage/unstage individual files or all at once
- Commit with message (Ctrl+Enter to commit)
- Push/Pull with ahead/behind indicators
- Branch switcher with search and create
- Commit timeline with click-to-view details
- Diff preview drawer for changed files
- Discard changes with slide-to-confirm

### Global Search (`Cmd+K`)

Search everything from anywhere:

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔍  Search files, tasks, agents...                                │
├─────────────────────────────────────────────────────────────────────┤
│  FILES                                                             │
│    src/lib/api.ts                                    Enter to open │
│    src/routes/tasks/+page.svelte                                   │
│                                                                    │
│  TASKS                                                             │
│    jat-abc  Add user authentication                   P1 · task   │
│    jat-xyz  Fix login timeout                         P0 · bug    │
│                                                                    │
│  AGENTS                                                            │
│    WildMeadow  working on jat-abc                                  │
│    BoldRiver   idle                                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Integrated Terminal

Access any agent's terminal session or run commands:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Terminal: jat-WildMeadow                              [×] [□] [−] │
├─────────────────────────────────────────────────────────────────────┤
│  $ npm run build                                                   │
│  > dashboard@0.0.1 build                                           │
│  > vite build                                                      │
│                                                                    │
│  vite v7.2.2 building for production...                           │
│  ✓ 1423 modules transformed                                        │
│  ✓ built in 12.34s                                                 │
│                                                                    │
│  $ _                                                               │
└─────────────────────────────────────────────────────────────────────┘
```

- Attach to any running agent session
- Send input directly to agents
- View real-time terminal output
- Interrupt with Ctrl+C

## The Routes

| Route | Purpose | Key Features |
|-------|---------|--------------|
| `/tasks` | Task Management | Create tasks, manage epics, set priorities, bulk actions |
| `/work` | Agent Supervision | Live sessions, smart questions, state tracking |
| `/files` | Code & Git | Monaco editor, file tree, full git integration |
| `/servers` | Dev Servers | npm start/stop, browser sessions, port management |
| `/config` | Settings | Automation rules, templates, keyboard shortcuts |
| `/automation` | Auto-Actions | Pattern matching, error recovery, auto-proceed |

## The Agentic Workflow

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   1. CREATE EPIC         "Build user authentication system"          │
│         ↓                                                            │
│   2. EPIC SWARM          Dashboard spawns 4 agents on subtasks       │
│         ↓                                                            │
│   3. PARALLEL WORK       Agents code simultaneously                  │
│         ↓                                                            │
│   4. SMART QUESTIONS     "OAuth or JWT?" → click a button            │
│         ↓                                                            │
│   5. REVIEW IN /files    See diffs, check code quality               │
│         ↓                                                            │
│   6. COMMIT & PUSH       Stage changes, write message, push          │
│         ↓                                                            │
│   7. AUTO-PROCEED        Low-priority tasks complete automatically   │
│                                                                      │
│   Repeat. Scale to 20+ agents. Ship faster.                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Why Not Just Use VS Code?

| Feature | VS Code + Copilot | JAT |
|---------|-------------------|-----|
| **Code editing** | ✅ Excellent | ✅ Monaco (same engine) |
| **Git integration** | ✅ Built-in | ✅ Full source control panel |
| **Multi-agent management** | ❌ Not designed for it | ✅ Core feature |
| **Task → Agent → Review** | ❌ Manual orchestration | ✅ One-click workflow |
| **Smart question UI** | ❌ Terminal prompts | ✅ Clickable buttons |
| **Parallel agent sessions** | ❌ One copilot | ✅ 20+ concurrent agents |
| **Auto-proceed rules** | ❌ None | ✅ By type/priority matrix |
| **Error recovery** | ❌ Manual | ✅ Auto-retry patterns |

**The answer:** You can use both. JAT for agent supervision, VS Code for deep debugging. But most users find they stop opening VS Code once they're comfortable with JAT.

## Keyboard Shortcuts

### Global (Work Everywhere)

| Shortcut | Action |
|----------|--------|
| `Cmd+K` / `Ctrl+K` | Global search |
| `Alt+N` | Create new task |
| `Alt+E` | Open Epic Swarm modal |
| `Alt+S` | Start next task dropdown |
| `Escape` | Close modals/drawers |

### Session (Hovering Agent Card)

| Shortcut | Action |
|----------|--------|
| `Alt+A` | Attach terminal |
| `Alt+K` | Kill session |
| `Alt+I` | Interrupt (Ctrl+C) |
| `Alt+P` | Pause agent |
| `Alt+1-9` | Jump to session by position |

### Files Page

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save file |
| `Alt+W` | Close tab |
| `Alt+P` | Quick file finder |
| `Alt+]` / `Alt+[` | Next/previous tab |

## Quick Start

```bash
# Clone and install
git clone https://github.com/joemcgee/jat.git ~/code/jat
cd ~/code/jat && ./install.sh
source ~/.bashrc

# Launch the IDE
jat

# Open http://localhost:5174
# Add a project → Create a task → Spawn an agent → Supervise
```

## Architecture

```
~/code/jat/
├── dashboard/          # SvelteKit app (the IDE)
│   ├── src/
│   │   ├── routes/     # /tasks, /work, /files, /servers, /config
│   │   └── lib/
│   │       ├── components/
│   │       │   ├── files/      # FileTree, FileEditor, GitPanel
│   │       │   ├── work/       # SessionCard, WorkPanel
│   │       │   └── agents/     # TaskTable, AgentGrid
│   │       └── stores/         # State management
├── tools/              # 50+ CLI tools
│   ├── core/           # Database, monitoring
│   ├── mail/           # Agent coordination (am-*)
│   ├── browser/        # Browser automation
│   └── signal/         # State synchronization
├── commands/           # Slash commands (/jat:start, /jat:complete)
└── shared/             # Agent-facing documentation
```

## Requirements

- **Node.js** 20+
- **tmux** (agent sessions run here)
- **Claude Code** or similar AI assistant
- **sqlite3**, **jq** (installed automatically)

## Configuration

All settings in `~/.config/jat/`:

| File | Purpose |
|------|---------|
| `projects.json` | Projects, defaults, spawn settings |
| `review-rules.json` | Auto-proceed matrix by type/priority |
| `templates/` | Custom command templates |

Dashboard settings at `/config`:
- Max concurrent sessions (default: 12)
- Default Claude model (opus/sonnet/haiku)
- Spawn stagger timing
- Keyboard shortcuts
- Automation rules

## Documentation

| Doc | Purpose |
|-----|---------|
| [CLAUDE.md](./CLAUDE.md) | Full technical reference |
| [dashboard/CLAUDE.md](./dashboard/CLAUDE.md) | Dashboard development guide |
| [QUICKSTART.md](./QUICKSTART.md) | Getting started guide |
| [shared/](./shared/) | Agent-facing documentation |

## FAQ

**Q: Is this only for Claude Code?**

JAT is optimized for Claude Code but works with any terminal-based AI assistant that supports the signal protocol. The key is tmux session management.

**Q: How many agents can I run?**

Tested with 20+ concurrent agents. Limited by your machine and API rate limits, not JAT. Default max is 12, configurable in settings.

**Q: Can I use this with existing projects?**

Yes. Run `bd init` in any git repo to add task tracking. JAT auto-discovers projects in `~/code/`.

**Q: Is there a hosted version?**

No. JAT runs 100% locally. Your code never leaves your machine.

**Q: Do I need to give up VS Code?**

No. Many users keep VS Code for complex debugging. But the Monaco editor + Git panel handles 95% of review and edit needs.

## Credits

- **Monaco** — VS Code's editor engine
- **Beads** — Task management ([steveyegge/beads](https://github.com/steveyegge/beads))
- **SvelteKit** — Dashboard framework
- **DaisyUI** — UI components
- **simple-git** — Git operations

## License

MIT

---

**JAT: The IDE where agents write code and you approve it.**
