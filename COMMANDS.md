# Agent Command Quick Reference

**9 commands for multi-agent orchestration**

## Getting Help

### `/jat:help` - Command Reference

**Usage:**
```bash
/jat:help                     # Show all commands
/jat:help start               # Show detailed help for specific command
```

**What it shows:**
- All 9 agent commands with examples
- Quick tips and common patterns
- Links to full documentation

**When to use:**
- Forgot command syntax
- Learning available commands
- Need quick reference

---

## Core Workflow (4 commands)

### `/jat:start` - Get to Work

**All parameter variations:**
```bash
/jat:start                    # Auto-create new agent (fast!)
/jat:start resume             # Choose from logged-out agents
/jat:start GreatWind          # Resume specific agent by name
/jat:start quick              # Start highest priority task immediately
/jat:start task-abc           # Start specific task (with checks)
/jat:start task-abc quick     # Start specific task (skip checks)
```

**What it does:**
1. Smart registration (auto-create or resume)
2. Session persistence (updates statusline)
3. Task selection (from parameter, context, or priority)
4. Conflict detection (file locks, git, dependencies)
5. Actually starts work (reserves files, sends mail, updates Beads)

---

### `/jat:next` - Drive Mode (Auto-Continue)

**Usage:**
```bash
/jat:next                     # Full verify + commit + auto-start next
/jat:next quick               # Quick commit + auto-start next (skip verify)
```

**What it does:**
- ✅ Verify task (tests, lint, security) - unless quick mode
- ✅ Commit changes
- ✅ Acknowledge all unread Agent Mail
- ✅ Announce completion
- ✅ Mark task complete in Beads
- ✅ Release file locks
- ✅ **Auto-start highest priority task** (continuous flow)

**When to use:**
- Flow state / drive mode
- Sprint work
- High velocity

---

### `/jat:complete` - Finish Properly (Manual Selection)

**Usage:**
```bash
/jat:complete                 # Full verify + show menu + recommended next
```

**What it does:**
- ✅ Verify task (tests, lint, security, browser)
- ✅ Commit changes
- ✅ Acknowledge all unread Agent Mail
- ✅ Announce completion
- ✅ Mark task complete in Beads
- ✅ Release file locks
- ✅ **Show available tasks menu**
- ✅ **Display recommended next task** (you choose)

**Output includes:**
```
✅ Task Completed: jat-abc "Add user settings"
👤 Agent: GreatWind

📋 Recommended Next Task:
   → jat-xyz "Update documentation" (Priority: P1)

   Type: /jat:start jat-xyz
```

**When to use:**
- Want to choose next task manually
- Context switch needed
- Review point
- End of work (before closing terminal)

---

### `/jat:pause` - Quick Pivot (Context Switch)

**Usage:**
```bash
/jat:pause                    # Quick exit + show menu
```

**What it does:**
- ✅ Quick commit/stash (always fast, no verification)
- ✅ Acknowledge all unread Agent Mail
- ✅ Send pause notification
- ✅ Mark task as incomplete (keeps in_progress)
- ✅ Release file locks
- ✅ **Show available tasks menu** (to pivot)

**When to use:**
- Emergency exit (laptop dying)
- Pivot to different work
- Blocked / can't continue
- Context switch

---

## Support Commands (5 commands)

### `/jat:status` - Check Current Work

**Usage:**
```bash
/jat:status                   # Shows current task, locks, messages
```

**What it shows:**
- Current task progress
- Active file reservations
- Unread Agent Mail messages
- Team sync (who's working on what)

---

### `/jat:verify` - Quality Checks

**Usage:**
```bash
/jat:verify                   # Verify current task
/jat:verify task-abc          # Verify specific task
```

**What it checks:**
- Tests (runs test suite)
- Lint (code quality)
- Security (common vulnerabilities)
- Browser (if applicable)

**Note:** Must pass before `/jat:complete`

---

### `/jat:plan` - Convert Planning to Tasks

**Usage:**
```bash
/jat:plan                     # Analyze conversation/PRD, create tasks
```

**What it does:**
- Analyzes conversation history OR written PRD
- Breaks work into atomic, testable tasks
- Creates Beads tasks with proper dependency chains
- Sets priorities (P0 = foundation, P1 = features, P2 = polish)
- Generates task descriptions with acceptance criteria

---

### `/jat:doctor` - Diagnose and Repair jat Setup

**Usage:**
```bash
/jat:doctor                   # Check installation health, fix issues
```

**What it checks:**
- ✅ jat repo exists at `~/code/jat`
- ✅ All 7 shared doc files present (`~/code/jat/shared/*.md`)
- ✅ CLAUDE.md has correct imports
- ✅ Statusline installed (`~/.claude/statusline.sh`)
- ✅ Agent commands installed (`~/.claude/commands/jat/*.md`)
- ✅ Tools symlinked to `~/bin`
- ✅ Beads initialized in project (`.beads/` directory)

**What it repairs:**
- 🔧 Missing imports in CLAUDE.md (adds all 7)
- 🔧 Malformed imports (fixes paths, typos)
- 🔧 Duplicate imports (removes extras)
- 🔧 Missing statusline (copies from jat)
- 🔧 Missing Beads (runs `bd init`)

**When to use:**
- After cloning a new project
- When jat features aren't working
- After updating jat
- Periodic health check

**Output:**
```
## jat Doctor Report

### Status: HEALTHY

### Checks:
✓ jat repo exists
✓ 7 shared docs present
✓ CLAUDE.md has all imports
✓ Statusline installed
✓ Agent commands installed (9)
✓ Tools available
✓ Beads initialized
```

---

## Common Workflows

### Drive Mode (Continuous Flow)
```bash
/jat:start                    # Create agent
/jat:start task-abc           # Start first task
/jat:next                     # Complete + auto-start next
/jat:next                     # Complete + auto-start next
/jat:next                     # Complete + auto-start next
# ... continuous loop, never stops ...
```

### Manual Mode (Careful Selection)
```bash
/jat:start                    # Create agent
/jat:start task-abc           # Start task
/jat:complete                 # Complete + show menu
# Review recommendations...
/jat:start task-xyz           # Pick manually
/jat:complete                 # Complete + show menu
# ... controlled workflow ...
```

### Quick Pivot (Context Switch)
```bash
/jat:start task-ui-123        # Working on UI
# Got stuck, need to switch...
/jat:pause                    # Quick exit + show menu
/jat:start task-bug-456       # Switch to different work
```

### Multi-Agent Coordination
```bash
# Terminal 1: Frontend (drive mode)
/jat:start
/jat:start task-ui-123
/jat:next                     # Auto-continues

# Terminal 2: Backend (manual)
/jat:start resume             # Choose logged-out agent
/jat:start task-api-456
/jat:complete                 # Manual control

# Terminal 3: QA (quick pivot)
/jat:start
/jat:start task-test-789
/jat:pause                    # Switch to urgent bug
/jat:start task-hotfix-001
```

---

## Quick Tips

**Speed:**
- Use `/jat:start quick` for immediate task start (no checks)
- Use `/jat:next quick` for rapid iteration (no verification)

**Control:**
- Use `/jat:complete` when you want to choose next task
- Use `/jat:pause` for emergency exits or context switches

**Quality:**
- Always run `/jat:verify` before `/jat:complete` for critical work
- Let `/jat:next` handle verification automatically (default mode)

**Coordination:**
- All commands acknowledge Agent Mail (stay synchronized)
- All commands announce completion (team visibility)
- File reservations prevent conflicts automatically

---

## See Also

- **Full Documentation:** `README.md`
- **Shared Docs:** `~/code/jat/shared/*.md` (imported by all projects)
- **Project-Specific Docs:** `CLAUDE.md`
- **Command Implementations:** `commands/jat/*.md`
- **Dashboard:** Run `bd-dashboard` to see tasks visually
- **Beads:** See `README.md` section on Beads command reference
