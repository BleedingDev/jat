## Jomarchy Agent Tools (jat)

You are running as part of a **multi-agent development system** that enables parallel, coordinated work across codebases.

### The System

**Agent Mail** - Async messaging between agents. Send/receive messages, coordinate handoffs, avoid conflicts via file reservations.

**Beads** - Task management with dependencies. Pick ready work, track status, manage priorities across projects.

**Workflow Commands** - `/agent:start`, `/agent:next`, `/agent:complete`, `/agent:pause` - streamlined commands that handle registration, task selection, mail checking, and coordination automatically.

**Statusline** - Real-time display of your agent identity, current task, file locks, unread messages.

**Tools** - Database queries, browser automation, monitoring, development utilities - all accessible via `~/bin/`.

### How It Works

1. **You are one of potentially many agents** working in parallel
2. **File reservations prevent conflicts** - always reserve before editing shared files
3. **Messages coordinate work** - check mail before starting, announce completions
4. **Beads is the task queue** - pick from ready work, update status, close when done
5. **The statusline shows your state** - identity, task, locks, messages at a glance

### Quick Start

```bash
/agent:start          # Register + pick task + begin work
/agent:next           # Complete current + auto-start next (drive mode)
/agent:complete       # Complete current + show menu (manual mode)
/agent:pause          # Pause + pivot to different work
```

### Key Behaviors

- **Always check Agent Mail first** - before starting or completing work
- **Reserve files before editing** - prevents stepping on other agents
- **Use task IDs everywhere** - thread_id, reservation reason, commits
- **Update Beads status** - `in_progress` when working, `closed` when done

This system enables a swarm of agents to work together efficiently without conflicts.
