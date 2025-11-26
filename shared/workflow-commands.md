## Agent Workflow Commands (Jomarchy Agent Tools)

**9 streamlined commands for multi-agent coordination** located in `~/code/jat/commands/agent/`

**Core Workflow:**
- `/agent:start [agent-name | task-id | quick]` - **Main command**: handles registration, task selection, conflict detection, and work start
- `/agent:next` - **Drive mode**: complete current task + auto-start next (high velocity)
- `/agent:complete [task-id]` - Finish work, verify, commit, show menu (manual selection)

**Coordination:**
- `/agent:pause task-id [--reason | --blocked | --handoff | --abandon]` - Unified stop command with 4 modes
- `/agent:status` - Check current work status, locks, messages

**Quality & Planning:**
- `/agent:verify [task-id]` - Pre-completion quality checks
- `/agent:plan` - Convert planning docs/conversation to Beads tasks

**Maintenance:**
- `/agent:help` - Command reference with examples
- `/agent:doctor` - Diagnose and repair jat setup (missing imports, broken config)

**CRITICAL: All commands check Agent Mail FIRST (before any work):**
- Read messages (display to user)
- Respond if needed (reply, adjust plan)
- Acknowledge after reading
- This is MANDATORY - not optional!

**Quick Start:**
```bash
# Simple workflow
/agent:start                    # Auto-detect or create agent, pick task
/agent:next                     # Complete + auto-start next (drive mode)

# With specific agent
/agent:start MyAgent            # Register as specific agent
/agent:start task-abc           # Start specific task (auto-registers if needed)

# Pause modes
/agent:pause task-abc --reason "Taking break"                # Keep locks
/agent:pause task-abc --blocked --reason "API down"          # Release locks, mark blocked
/agent:pause task-abc --handoff Alice --reason "Need help"  # Hand off to another agent
/agent:pause task-abc --abandon --reason "Not needed"        # Release locks, unassign
```

**Session-Aware:**
Each command automatically updates `.claude/agent-{session_id}.txt` for statusline display. Supports multiple concurrent agents in different terminals.

**See project CLAUDE.md for detailed documentation.**
