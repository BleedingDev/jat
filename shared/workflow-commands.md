## Agent Workflow Commands (Jomarchy Agent Tools)

**9 streamlined commands for multi-agent coordination** located in `~/code/jat/commands/jat/`

**Core Workflow:**
- `/jat:start [agent-name | task-id | quick]` - **Main command**: handles registration, task selection, conflict detection, and work start
- `/jat:next` - **Drive mode**: complete current task + auto-start next (high velocity)
- `/jat:complete [task-id]` - Finish work, verify, commit, show menu (manual selection)

**Coordination:**
- `/jat:pause task-id [--reason | --blocked | --handoff | --abandon]` - Unified stop command with 4 modes
- `/jat:status` - Check current work status, locks, messages

**Quality & Planning:**
- `/jat:verify [task-id]` - Pre-completion quality checks
- `/jat:plan` - Convert planning docs/conversation to Beads tasks

**Maintenance:**
- `/jat:help` - Command reference with examples
- `/jat:doctor` - Diagnose and repair jat setup (missing imports, broken config)

**CRITICAL: All commands check Agent Mail FIRST (before any work):**
- Read messages (display to user)
- Respond if needed (reply, adjust plan)
- Acknowledge after reading
- This is MANDATORY - not optional!

**Quick Start:**
```bash
# Simple workflow
/jat:start                    # Auto-detect or create agent, pick task
/jat:next                     # Complete + auto-start next (drive mode)

# With specific agent
/jat:start MyAgent            # Register as specific agent
/jat:start task-abc           # Start specific task (auto-registers if needed)

# Pause modes
/jat:pause task-abc --reason "Taking break"                # Keep locks
/jat:pause task-abc --blocked --reason "API down"          # Release locks, mark blocked
/jat:pause task-abc --handoff Alice --reason "Need help"  # Hand off to another agent
/jat:pause task-abc --abandon --reason "Not needed"        # Release locks, unassign
```

**Session-Aware:**
Each command automatically updates `.claude/agent-{session_id}.txt` for statusline display. Supports multiple concurrent agents in different terminals.

**See project CLAUDE.md for detailed documentation.**
