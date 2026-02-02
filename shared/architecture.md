## JAT Architecture: Two-Layer Design

JAT is built on a two-layer architecture that separates transparent UI enhancement from explicit agent coordination.

### Layer 1: Transparent Enhancement (Agent-Agnostic)

**The agent is completely oblivious to the UI.**

This layer uses the "sidecar" pattern - external apps that enhance the agent experience without the agent knowing or caring.

**How it works:**
```
CLI Agent (any) ──► PostToolUse Hooks ──► Temp Files ──► IDE UI
                                                              │
                                                              ▼
                                                         tmux keys
                                                              │
                                                              ▼
                                              Agent receives input
```

**Key characteristics:**
- Works with ANY CLI agent (Claude Code, Aider, Cline, Codex, etc.)
- No changes to the agent needed
- Pattern: hooks + temp files + tmux
- Agent doesn't know about the IDE

**Examples:**
- Smart Question UI (buttons instead of typing numbers)
- Diff viewer for file changes
- Terminal output with ANSI rendering
- Session status monitoring

**Implementation:**
- `PostToolUse` hooks capture tool outputs
- Data written to `/tmp/` files (JSON)
- IDE polls or uses SSE to read state
- User actions sent back via `tmux send-keys`

### Layer 2: Explicit Coordination (JAT-Specific)

**The agent explicitly participates in the system.**

This layer requires the agent to understand and use JAT's coordination tools.

**How it works:**
```
Agent reads AGENTS.md / CLAUDE.md ──► Uses Agent Mail ──► Picks tasks from Beads
                              │                        │
                              ▼                        ▼
                    Coordinates with          Updates task status
                    other agents              Follows dependencies
```

**Key characteristics:**
- Agent knows about and uses the system
- Requires an instruction file (`AGENTS.md` for Codex/Codex-native, `CLAUDE.md` for Claude Code) to instruct behavior
- Agent Mail for coordination between agents
- Beads for task management and dependencies

**Examples:**
- `/jat:start` - Register agent, pick task
- `/jat:complete` - Close task, announce completion
- File reservations to prevent conflicts
- Message threads for coordination

**Implementation:**
- `AGENTS.md` / `CLAUDE.md` documents the system
- Agent Mail tools (`am-*`) for messaging
- Beads CLI (`bd`) for task management
- Signal system for state updates

### The Relationship

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   LAYER 2: Agent Orchestration (JAT-specific)                      │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  • Agent Mail (coordination)                                 │  │
│   │  • Beads (task management)                                   │  │
│   │  • AGENTS.md / CLAUDE.md (agent instructions)                 │  │
│   │  • Workflow commands (/jat:start, /jat:complete)            │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              ▲                                      │
│                              │ built on                             │
│                              │                                      │
│   LAYER 1: Transparent Enhancement (agent-agnostic)                │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  • PostToolUse hooks                                         │  │
│   │  • Temp file state sharing                                   │  │
│   │  • tmux session management                                   │  │
│   │  • SSE for real-time updates                                 │  │
│   │  • IDE UI rendering                                    │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key insight:**
- Layer 1 is extractable and general-purpose
- Layer 2 requires agent buy-in, JAT-specific
- You could use Layer 1 without Layer 2
- Layer 2 is built on top of Layer 1

### Why This Matters

**For users:**
- Layer 1 benefits are immediate (better UI) without training agents
- Layer 2 unlocks multi-agent orchestration for power users

**For developers:**
- Clear separation of concerns
- Layer 1 patterns work for any CLI tool, not just AI agents
- Layer 2 can evolve independently

**For the ecosystem:**
- Layer 1 patterns could be adopted by other tools
- Hooks + files + tmux is a universal enhancement pattern
- No vendor lock-in at the UI enhancement level

### Files Reference

**Layer 1 (Transparent):**
- `/tmp/jat-signal-tmux-*.json` - Per-session signal state (agent-agnostic)
- `.claude/hooks/` - Claude Code PostToolUse hook scripts (optional)
- `.claude/settings.json` - Claude Code hook configuration (optional)
- `/tmp/claude-question-*.json` - Smart question UI state (Claude hook-based, optional)
- `~/.codex/sessions/` - Codex/Codex-native session logs (used for usage/resume mapping)
- `ide/src/routes/api/sessions/events/` - SSE endpoints

**Layer 2 (Explicit):**
- `AGENTS.md` / `CLAUDE.md` - Agent instructions
- `shared/*.md` - Agent documentation
- `tools/mail/` - Agent Mail tools
- `commands/jat/` - Workflow commands
- `.beads/` - Task database
