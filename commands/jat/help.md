---
argument-hint:
---

Display help information for agent commands.

# Agent Help - Command Reference

**Usage:**
- `/jat:help` - Show all agent commands
- `/jat:help start` - Show detailed help for specific command
- `/jat:help --quick` - Show quick reference only

**What this command does:**
Displays comprehensive help information for all agent coordination commands, similar to `--help` flags in bash commands.

---

## Implementation

**Default (no arguments):** Show all commands with brief descriptions

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📖 Agent Command Reference - 7 commands for multi-agent orchestration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "CORE WORKFLOW (4 commands):"
echo ""
echo "  /jat:start [agent|task|quick|resume]"
echo "    Get to work - register agent, select task, start working"
echo "    Examples:"
echo "      /jat:start                    # Auto-create new agent"
echo "      /jat:start resume             # Choose from logged-out agents"
echo "      /jat:start task-abc           # Start specific task"
echo "      /jat:start task-abc quick     # Skip conflict checks"
echo ""
echo "  /jat:next [quick]"
echo "    Drive mode - complete current task, auto-start next"
echo "    Examples:"
echo "      /jat:next                     # Full verify + auto-continue"
echo "      /jat:next quick               # Skip verify, fast iteration"
echo ""
echo "  /jat:complete [task-id]"
echo "    Finish properly - verify, commit, show menu, you choose next"
echo "    Examples:"
echo "      /jat:complete                 # Complete current task"
echo ""
echo "  /jat:pause [task-id] [options]"
echo "    Quick pivot - pause/block/handoff/abandon current work"
echo "    Examples:"
echo "      /jat:pause --reason \"Break\"           # Keep locks"
echo "      /jat:pause --blocked --reason \"API\"  # Release locks"
echo "      /jat:pause --handoff Alice            # Hand off to agent"
echo "      /jat:pause --abandon                  # Unassign task"
echo ""
echo "SUPPORT COMMANDS (3 commands):"
echo ""
echo "  /jat:status"
echo "    Check current work - task, locks, messages, team sync"
echo ""
echo "  /jat:verify [task-id]"
echo "    Quality checks - tests, lint, security, browser"
echo ""
echo "  /jat:plan"
echo "    Convert planning to tasks - analyze conversation/PRD, create Beads tasks"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "QUICK TIPS:"
echo ""
echo "  Speed:        /jat:start quick  /jat:next quick"
echo "  Control:      /jat:complete (manual selection)"
echo "  Quality:      /jat:verify before /jat:complete"
echo "  Coordination: All commands sync via Agent Mail"
echo ""
echo "LEARN MORE:"
echo ""
echo "  Full docs:    cat COMMANDS.md"
echo "  README:       cat README.md"
echo "  Dashboard:    bd-dashboard"
echo "  Agent Mail:   cat ~/.claude/CLAUDE.md"
echo ""
echo "For detailed help on a specific command:"
echo "  /jat:help start"
echo "  /jat:help next"
echo "  /jat:help complete"
echo ""
```

**With specific command argument:** Show detailed help for that command

```bash
#!/bin/bash

# Get command name from argument
COMMAND="$1"

if [[ -z "$COMMAND" ]]; then
    # Show full help (default - already shown above)
    exit 0
fi

# Show detailed help for specific command
case "$COMMAND" in
    start)
        cat ~/code/jat/commands/jat/start.md | grep -A 50 "^# Agent Start"
        ;;
    next)
        cat ~/code/jat/commands/jat/next.md | grep -A 30 "^# Agent Next"
        ;;
    complete)
        cat ~/code/jat/commands/jat/complete.md | grep -A 30 "^# Agent Complete"
        ;;
    pause)
        cat ~/code/jat/commands/jat/pause.md | grep -A 40 "^# Agent Pause"
        ;;
    status)
        cat ~/code/jat/commands/jat/status.md | grep -A 20 "^# Agent Status"
        ;;
    verify)
        cat ~/code/jat/commands/jat/verify.md | grep -A 20 "^# Agent Verify"
        ;;
    plan)
        cat ~/code/jat/commands/jat/plan.md | grep -A 20 "^# Agent Plan"
        ;;
    *)
        echo "❌ Unknown command: $COMMAND"
        echo ""
        echo "Available commands:"
        echo "  start, next, complete, pause, status, verify, plan"
        echo ""
        echo "Usage: /jat:help <command>"
        exit 1
        ;;
esac
```

---

## Output Examples

**Full help (default):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 Agent Command Reference - 7 commands for multi-agent orchestration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CORE WORKFLOW (4 commands):

  /jat:start [agent|task|quick|resume]
    Get to work - register agent, select task, start working
    Examples:
      /jat:start                    # Auto-create new agent
      /jat:start resume             # Choose from logged-out agents
      /jat:start task-abc           # Start specific task
      /jat:start task-abc quick     # Skip conflict checks

  /jat:next [quick]
    Drive mode - complete current task, auto-start next
    Examples:
      /jat:next                     # Full verify + auto-continue
      /jat:next quick               # Skip verify, fast iteration

  /jat:complete [task-id]
    Finish properly - verify, commit, show menu, you choose next
    Examples:
      /jat:complete                 # Complete current task

  /jat:pause [task-id] [options]
    Quick pivot - pause/block/handoff/abandon current work
    Examples:
      /jat:pause --reason "Break"           # Keep locks
      /jat:pause --blocked --reason "API"  # Release locks
      /jat:pause --handoff Alice            # Hand off to agent
      /jat:pause --abandon                  # Unassign task

SUPPORT COMMANDS (3 commands):

  /jat:status
    Check current work - task, locks, messages, team sync

  /jat:verify [task-id]
    Quality checks - tests, lint, security, browser

  /jat:plan
    Convert planning to tasks - analyze conversation/PRD, create Beads tasks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUICK TIPS:

  Speed:        /jat:start quick  /jat:next quick
  Control:      /jat:complete (manual selection)
  Quality:      /jat:verify before /jat:complete
  Coordination: All commands sync via Agent Mail

LEARN MORE:

  Full docs:    cat COMMANDS.md
  README:       cat README.md
  Dashboard:    bd-dashboard
  Agent Mail:   cat ~/.claude/CLAUDE.md

For detailed help on a specific command:
  /jat:help start
  /jat:help next
  /jat:help complete
```

**Specific command help:**
```bash
$ /jat:help start

# Agent Start - Get to Work

Usage:
- /jat:start                    # Auto-create new agent (fast!)
- /jat:start resume             # Choose from logged-out agents
- /jat:start GreatWind          # Resume specific agent by name
- /jat:start quick              # Start highest priority task immediately
- /jat:start task-abc           # Start specific task (with checks)
- /jat:start task-abc quick     # Start specific task (skip checks)

What it does:
1. Smart registration (auto-create or resume)
2. Session persistence (updates statusline)
3. Task selection (from parameter, context, or priority)
4. Conflict detection (file locks, git, dependencies)
5. Actually starts work (reserves files, sends mail, updates Beads)

[... continues with full start.md content ...]
```

---

## Use Cases

**Quick reference while coding:**
```bash
# Forgot command syntax?
/jat:help
# → Shows all commands with examples

# Need detailed info about a specific command?
/jat:help pause
# → Shows full pause.md documentation
```

**New user onboarding:**
```bash
# First time using agent commands
/jat:help
# → See all available commands and their purposes

# Ready to start first task
/jat:help start
# → Learn all variations of /jat:start
```

**Command discovery:**
```bash
# What commands are available?
/jat:help
# → Complete command reference

# How do I switch tasks quickly?
/jat:help pause
# → Learn about pause modes (block, handoff, abandon)
```
