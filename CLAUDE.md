# Jomarchy Agent Tools

Lightweight bash tools for agent orchestration, database operations, monitoring, development, and browser automation.

## Project Structure

```
jat/
├── mail/                # Agent Mail coordination system (11 tools)
├── commands/agent/      # Agent workflow commands (8 commands)
├── browser-tools/       # Browser automation tools (11 tools)
├── tools/               # Database & monitoring tools (6 tools)
├── dashboard/           # Beads Task Dashboard (SvelteKit app)
├── scripts/             # Installation and setup scripts
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
/agent:start
```

## Session-Aware Statusline

**The statusline automatically displays your agent identity and status for each Claude Code session.**

### How It Works

Each Claude Code session has a unique `session_id`. The statusline uses this to track agent identity independently per session:

```
Session 1: FreeMarsh  | [P1] task-abc - Building dashboard [🔒2 📬1 ⏱45m]
Session 2: PaleStar   | idle [📬3]
Session 3: StrongShore | [P0] task-xyz - Critical bug fix [🔒1]
```

### Registration

When you run `/agent:start` or `/agent:register`, it automatically:
1. Registers your agent in Agent Mail
2. Writes agent name to `.claude/agent-{session_id}.txt`
3. Statusline reads from that file and displays your identity

**No manual setup needed** - just run a command and the statusline updates!

### What the Statusline Shows

**Format:** `AgentName | [Priority] Task ID - Task Title [Indicators]`

**Indicators:**
- 🔒N - Active file reservations
- 📬N - Unread messages in inbox
- ⏱Xm/Xh - Time until lock expires
- N% - Task progress (if tracked)

**Examples:**
```
FreeMarsh | [P1] jat-m95 - Update /start... [🔒2 📬1 ⏱45m]
FreeMarsh | idle [📬3]
jat | no agent registered
```

### Multi-Agent Sessions

**Run as many agents as you want simultaneously!** Each session maintains its own identity:

```bash
# Terminal 1
/agent:start  # Choose FreeMarsh
# Statusline shows: FreeMarsh | ...

# Terminal 2
/agent:start  # Choose PaleStar
# Statusline shows: PaleStar | ...

# Terminal 3
/agent:start  # Choose StrongShore
# Statusline shows: StrongShore | ...
```

All three sessions work independently with their own agent identities.

### Files Created

- `.claude/agent-{session_id}.txt` - Your agent name for this session
- `/tmp/claude-session-${PPID}.txt` - PPID-based session ID (process-isolated)
- `.claude/statusline.sh` - The statusline script

**These files are session-specific** - don't commit `agent-*.txt` files to git (they're per-developer session).

### Status Calculation Algorithm

**How the statusline determines what to display:**

The statusline follows a priority-based decision tree to determine agent status:

```
┌─ STATUS CALCULATION DECISION TREE ─────────────────────────────────────┐
│                                                                        │
│  1. Check if agent is registered                                      │
│     └─ NO → Show "jat | no agent registered"                          │
│     └─ YES → Continue to step 2                                       │
│                                                                        │
│  2. Check Beads for in_progress tasks assigned to agent               │
│     └─ FOUND → Use task from Beads (Priority 1 source)                │
│     └─ NOT FOUND → Continue to step 3                                 │
│                                                                        │
│  3. Check file reservations for task ID in reason field               │
│     └─ FOUND → Extract task ID, lookup in Beads (Priority 2 source)   │
│     └─ NOT FOUND → Continue to step 4                                 │
│                                                                        │
│  4. No active task found                                              │
│     └─ Show "AgentName | idle"                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Priority Order (what's checked first):**

1. **Agent Registration** - `.claude/agent-{session_id}.txt` exists?
2. **Beads in_progress** - `bd list --json | filter(assignee == agent && status == "in_progress")`
3. **File Reservations** - `am-reservations --agent X | extract task ID from reason`
4. **Idle State** - Agent registered but no work

**Why this order matters:**

- **Beads is source of truth** - If Beads says task is `in_progress`, show it (even without reservations)
- **Reservations are fallback** - If agent has reservations but forgot to update Beads
- **Prevents false "idle"** - Agent working but statusline shows idle is confusing

**Edge Cases Handled:**

1. **Task closed but reservation still active**
   - Shows task from reservation (statusline doesn't check task status)
   - `/agent:start` smart cleanup will release stale reservations

2. **Multiple in_progress tasks**
   - Shows first task returned by Beads (should not happen in normal workflow)

3. **Reservation without task ID in reason**
   - Shows idle (can't extract task ID to lookup)

4. **Session file missing but agent registered globally**
   - Shows "no agent registered" (session-specific, not global)

**Indicator Colors (dynamic thresholds):**

```
🔒 File Locks:
  - Cyan (1-2 locks)    - Normal load
  - Yellow (3-5 locks)  - Moderate load
  - Red (>5 locks)      - Heavy load

📬 Unread Messages:
  - Cyan (1-5 msgs)     - Few messages
  - Yellow (6-15 msgs)  - Moderate backlog
  - Red (>15 msgs)      - Needs attention

⏱ Time Remaining:
  - Green (>30 min)     - Plenty of time
  - Yellow (10-30 min)  - Mid-way
  - Red (<10 min)       - About to expire

📊 Task Progress:
  - Red (<25%)          - Just started
  - Yellow (25-75%)     - In progress
  - Green (>75%)        - Almost done
```

**Examples for Each Status State:**

```
# 1. No agent registered
jat | no agent registered

# 2. Agent registered, no work
GreatLake | idle [📬3]

# 3. Active task from Beads (in_progress)
GreatLake | [P1] jat-va3 - Document statusline... [🔒2 📬26 ⏱45m]

# 4. Active task from file reservation (fallback)
GreatLake | [P0] jat-abc - Critical bug fix [🔒1 ⏱15m]

# 5. Multiple indicators (full status)
RichPrairie | [P1] jat-xyz - Feature work [🔒3 📬12 ⏱8m 65%]
              └─ Yellow locks, yellow messages, red time, yellow progress
```

**Where the Logic Lives:**

- **Statusline**: `.claude/statusline.sh` (lines 210-400)
  - Session-specific agent identity
  - Status calculation decision tree
  - Indicator color thresholds

- **Dashboard**: `dashboard/src/routes/api/agents/+server.js`
  - Uses same logic via `getAgentStatus()` function
  - Shared algorithm prevents drift

**Code Reference:**

```bash
# Priority 1: Check Beads for in_progress tasks
# .claude/statusline.sh:226-238
task_json=$(bd list --json | jq -r --arg agent "$agent_name" \
    '.[] | select(.assignee == $agent and .status == "in_progress")')

# Priority 2: Fall back to file reservations
# .claude/statusline.sh:242-263
reservation_info=$(am-reservations --agent "$agent_name")
task_id=$(echo "$reservation_info" | grep -oE 'jat-[a-z0-9]{3}')
```

**Troubleshooting:**

| Issue | Cause | Fix |
|-------|-------|-----|
| Shows "idle" but I'm working | Task not marked `in_progress` in Beads | Run `bd update task-id --status in_progress` |
| Shows wrong task | Old reservation from previous task | Release stale reservation with `am-release` |
| Shows "no agent registered" | Session file missing | Run `/agent:start` to register |
| Indicator count seems wrong | Cached data, stale reservations | Wait 1 min for statusline refresh |

### Why PPID-Based Session Tracking?

**The Problem: Race Conditions with Shared Files**

Initially, we used a shared file `.claude/current-session-id.txt` that all Claude Code instances would read/write. This caused race conditions:

```bash
# Terminal 1 (FreeMarsh) writes session ID
echo "session-abc" > .claude/current-session-id.txt

# Terminal 2 (PaleStar) writes IMMEDIATELY after
echo "session-xyz" > .claude/current-session-id.txt  # Overwrites!

# Terminal 1 tries to read its session ID
cat .claude/current-session-id.txt  # Gets "session-xyz" - WRONG!
```

**The Solution: PPID-Based Process Isolation**

Each Claude Code session runs in a unique process with its own Parent Process ID (PPID). We use this for isolation:

```bash
# Terminal 1: PPID = 12345
/tmp/claude-session-12345.txt → "session-abc"

# Terminal 2: PPID = 67890
/tmp/claude-session-67890.txt → "session-xyz"

# No conflicts! Each process has its own file.
```

**File Lifecycle:**
- **Creation**: Statusline creates `/tmp/claude-session-${PPID}.txt` on first render
- **Updates**: Statusline updates the file on every render (writes current session ID)
- **Cleanup**: OS automatically deletes `/tmp` files when process exits
- **Location**: `/tmp` (not `.claude/`) because it's process-specific, not project-specific

**Multiple Terminals Example:**

```bash
# Terminal 1 (PPID: 12345)
/tmp/claude-session-12345.txt → "a019c84c..."
.claude/agent-a019c84c....txt → "FreeMarsh"

# Terminal 2 (PPID: 67890)
/tmp/claude-session-67890.txt → "9b2a2fac..."
.claude/agent-9b2a2fac....txt → "PaleStar"

# Each terminal has independent session tracking - no race conditions!
```

### Troubleshooting Statusline Issues

**Problem: Statusline shows wrong agent name or different session's agent**

This happens when multiple Claude Code sessions are running and you need to update your current session's identity.

**❌ This does NOT work:**
```bash
# Environment variables don't persist to statusline
export AGENT_NAME=ShortTundra
am-register --name ShortTundra ...
```

**✅ This DOES work - write to your session file:**
```bash
# Get your session ID (PPID-based)
session_id=$(cat /tmp/claude-session-${PPID}.txt 2>/dev/null | tr -d '\n')

# Write your agent name to YOUR session's file
echo "ShortTundra" > ".claude/agent-${session_id}.txt"
```

**One-liner fix:**
```bash
session_id=$(cat /tmp/claude-session-${PPID}.txt | tr -d '\n') && echo "ShortTundra" > ".claude/agent-${session_id}.txt"
```

Your statusline updates immediately - no restart needed!

**Why this works:**
- Each Claude Code session has a unique `session_id` (e.g., `abc123`)
- The statusline reads from `.claude/agent-{your-session-id}.txt`
- Other sessions have their own files (`.claude/agent-{other-id}.txt`)
- `export AGENT_NAME=` only affects bash subprocesses, not the statusline process
- Writing to the session file is the only way to update the statusline

**Checking which session you're in:**
```bash
# See your session ID (PPID-based)
cat /tmp/claude-session-${PPID}.txt

# See your PPID (parent process ID)
echo $PPID

# See all session files for this project
ls -la .claude/agent-*.txt

# See your session's agent name
session_id=$(cat /tmp/claude-session-${PPID}.txt | tr -d '\n') && cat ".claude/agent-${session_id}.txt"
```

## Agent Workflow Commands

**All agent commands are in `./commands/agent/` and available via `/agent:*` namespace.**

### Command Overview

| Command | Purpose | Size |
|---------|---------|------|
| `/agent:start` | **Main command** - register + task start | 33K |
| `/agent:register` | Explicit registration with full review | 11K |
| `/agent:pause` | **Unified stop** - pause/block/handoff/abandon | 12K |
| `/agent:complete` | Finish task, release files, close | 27K |
| `/agent:finish` | **End session** - wrap up, clean state, goodbye | 16K |
| `/agent:status` | Check current work status | 21K |
| `/agent:plan` | Plan work strategy | 27K |
| `/agent:verify` | Verify task completion | 29K |

### `/agent:start` - Get to Work Command

**The main command** - handles registration, task selection, conflict detection, and actually starts work.

**Usage:**
```bash
/agent:start                    # Auto-detect/create agent, show tasks
/agent:start AgentName          # Register as specific agent
/agent:start task-abc           # Start specific task (full flow)
/agent:start task-abc quick     # Skip conflict checks (fast)
```

**What it does:**
1. **Smart Registration:** Auto-detects recent agents (last 60 min) or creates new
2. **Session Persistence:** Updates `.claude/agent-{session_id}.txt` for statusline
3. **Task Selection:** From parameter, conversation context, or priority
4. **Conflict Detection:** File locks, git changes, dependencies
5. **Actually Starts Work:** Reserves files, sends Agent Mail, updates Beads

**How it works:**

**1. Auto-Detection (Default):**
- Checks if you're already registered (session file exists)
- If not: looks for agents active in last **60 minutes**
- Recent agents found → shows menu to resume
- No recent agents → auto-creates new agent with random name
- Sets statusline automatically

**2. Explicit Agent:**
```bash
/agent:start MyAgent
```
- Register as specific agent
- Show task recommendations
- Useful when you know which agent you want

**3. Start Specific Task:**
```bash
/agent:start jat-abc
```
- Auto-registers if needed (using 60-min detection)
- Runs full conflict checks
- Reserves files
- Sends Agent Mail notification
- Updates Beads status
- **Actually starts work** (not just recommendations)

**4. Quick Mode:**
```bash
/agent:start task-abc quick
```
- Skips conflict detection
- Skips dependency checks
- For when you're solo or need speed

**Examples:**
```bash
# Scenario 1: Fresh session, you worked 30 min ago
/agent:start
# → Shows menu: "Resume FreeMarsh (last active 30 min ago)"

# Scenario 2: Fresh session, no recent work
/agent:start
# → Auto-creates: "✨ Created new agent: BrightCove"

# Scenario 3: Already registered, start specific task
/agent:start jat-zdl
# → Checks conflicts, reserves files, starts task

# Scenario 4: Fast mode
/agent:start jat-zdl quick
# → Skips checks, starts immediately
```

### `/agent:register` - Explicit Registration

**Show all agents and choose** - for when you want full visibility.

**Usage:**
```bash
/agent:register     # Interactive menu with all agents
```

**Purpose:**
- See **ALL** registered agents (no time filter)
- Full review: inbox, tasks, categorization
- Explicit choice (no auto-creation without confirmation)

**When to use:**
- Want to see all agents (not just recent)
- Need full registration review
- Setting up multi-agent coordination

**vs `/agent:start`:**

| Feature | `/agent:start` | `/agent:register` |
|---------|----------------|-------------------|
| Registration | Auto-detect (60 min) | Show all agents |
| Task start | Yes (if task ID provided) | No (review only) |
| Auto-create | Yes (if no recent agents) | Yes (with confirmation) |
| Review depth | Quick summary | Full analysis |
| Use case | "Get me working" | "Show me everything" |

### `/agent:pause` - Stop Work (Unified)

**Stop working on a task** - one command for all stop scenarios.

**Usage:**
```bash
# Simple pause (keep file locks)
/agent:pause task-abc --reason "Taking break"

# Mark as blocked (release locks)
/agent:pause task-abc --blocked --reason "API is down"

# Hand off to another agent (release locks)
/agent:pause task-abc --handoff Alice --reason "Need frontend expertise"

# Abandon work (release locks, unassign)
/agent:pause task-abc --abandon --reason "Requirements changed"
```

**Modes:**

| Mode | File Locks | Task Status | Assignee | Use When |
|------|------------|-------------|----------|----------|
| Default (pause) | Kept | Unchanged | Unchanged | Taking break, will resume |
| `--blocked` | Released | → blocked | Unchanged | External blocker, can't proceed |
| `--handoff` | Released | Unchanged | → New agent | Need different expertise |
| `--abandon` | Released | → open | Cleared | Task obsolete or rethinking needed |

**What it does:**
1. Releases file reservations (based on mode)
2. Updates task status in Beads
3. Sends Agent Mail notification
4. Updates session state

**Examples:**
```bash
# End of day
/agent:pause task-abc --reason "End of day, will resume tomorrow"

# Blocked by dependency
/agent:pause task-abc --blocked --reason "Waiting for API documentation from backend team"

# Need help
/agent:pause task-abc --handoff SeniorDev --reason "Complex algorithm, need expert review"

# Task no longer needed
/agent:pause task-abc --abandon --reason "Product decided to go different direction"
```

### `/agent:complete` - Finish Task

**Complete task** - closes in Beads, releases files, sends notifications.

**Usage:**
```bash
/agent:complete task-abc        # Normal completion
```

**What it does:**
1. Releases all file reservations
2. Marks task as completed in Beads
3. Sends completion notification in Agent Mail
4. Updates agent status

### Other Agent Commands

**`/agent:status`** - Check what you're working on
```bash
/agent:status    # Shows current task, locks, messages
```

**`/agent:plan`** - Plan work strategy
```bash
/agent:plan     # Strategic planning for complex work
```

**`/agent:verify`** - Verify task completion
```bash
/agent:verify task-abc    # Verify all acceptance criteria met
```

### Command Workflow Recommendations

**Most Common Workflow:**
```bash
# 1. Start your session
/agent:start

# 2. Work on tasks
# (statusline shows your agent identity)

# 3. Switch tasks
/agent:start task-xyz

# 4. Pause if needed
/agent:pause task-xyz --reason "Switching to urgent work"

# 5. Complete task
/agent:complete task-xyz

# 6. End session (going to bed)
/agent:finish
```

**Multi-Agent Coordination:**
```bash
# Terminal 1 (Frontend work)
/agent:start              # Resume FreeMarsh
/agent:start task-ui-123  # Start UI task

# Terminal 2 (Backend work)
/agent:start PaleStar     # Use specific agent
/agent:start task-api-456 # Start API task

# Terminal 3 (Testing)
/agent:register           # See all agents, choose one
/agent:start task-test-789
```

### `/agent:finish` - End Session Command

**End your work session gracefully.** Use this when going to bed or shutting down:

```bash
/agent:finish                # Full session wrap-up
/agent:finish --skip-summary # Quick cleanup without summary
/agent:finish --no-commit    # Don't auto-commit/stash changes
```

**What it does:**
1. Handles in-progress work (pause, keep, or complete)
2. Releases all file reservations
3. Commits or stashes uncommitted changes
4. Reviews and acknowledges unread messages
5. Generates session summary
6. Sends summary to Agent Mail (thread: daily-summaries)
7. Shows tomorrow's top priorities
8. Clears session state

**When to use:**
- End of work session
- Going to bed
- Shutting down computer
- Want a clean slate for tomorrow

**Output includes:**
- Session duration
- Completed tasks today
- Git activity (commits, files changed)
- Tomorrow's top 3 priorities
- Cleanup confirmation

**Troubleshooting:**
```bash
# Statusline shows "no agent registered"?
/agent:start              # Quick fix

# Want to see all agents (not just recent)?
/agent:register           # Full agent list

# Need to hand off work?
/agent:pause task-abc --handoff OtherAgent --reason "Need expert"

# Going to bed?
/agent:finish             # Full session wrap-up

# Task blocked by dependency?
/agent:pause task-abc --blocked --reason "Waiting for X"
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
# Launch dashboard from anywhere
bd-dashboard        # Checks dependencies, starts server, opens browser
jat-dashboard       # Alias for bd-dashboard

# What it does:
# - Checks for node_modules, runs npm install if needed
# - Starts dev server on http://127.0.0.1:5174
# - Opens browser automatically after 3 seconds
```

**Manual Commands:**
```bash
cd dashboard

# Install dependencies
npm install

# Start dev server (usually http://127.0.0.1:5174)
npm run dev

# Clean build cache if themes aren't loading
rm -rf .svelte-kit node_modules/.vite
npm run dev
```

### ⚠️ Critical Dashboard Issue: Tailwind v4

The dashboard uses **Tailwind CSS v4**, which has completely different syntax:

**❌ This does NOT work (v3 syntax):**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**✅ You MUST use this (v4 syntax):**
```css
@import "tailwindcss";

@plugin "daisyui" {
  themes: light, dark, nord --default, ...;
}
```

See `dashboard/CLAUDE.md` for full details.

## Agent Mail Tools

For multi-agent coordination. See `~/.claude/CLAUDE.md` for full Agent Mail documentation.

**Quick Reference:**
```bash
# Register agent
# RECOMMENDED: Use /agent:start or /agent:register (automatically updates statusline!)
# Or manually: am-register --name AgentName --program claude-code --model sonnet-4.5

# Reserve files
am-reserve "src/**/*.ts" --agent AgentName --ttl 3600 --exclusive --reason "task-abc"

# Send messages
# Basic messaging
am-send "Subject" "Body" --from Agent1 --to Agent2 --thread task-abc

# Broadcast messaging (multi-agent)
am-send "Update" "Status" --from Dev --to @active --importance high                    # Active agents (last 60 min)
am-send "Urgent" "Need help" --from Dev --to @active --active-window 15 --importance urgent  # Custom window (15 min)
am-send "Team sync" "Sprint done" --from Lead --to @project:jat                        # All agents in project
am-send "Critical" "System down" --from Monitor --to @all --importance urgent          # ALL agents (even offline)
am-send "Review needed" "PR ready" --from Dev --to @active,SeniorDev                   # Mixed (broadcast + specific)

# Check inbox
am-inbox AgentName --unread                                         # Only unread messages
am-inbox AgentName --unread --hide-acked                            # Cleanest view (filters acknowledged broadcasts)
am-inbox AgentName --hide-acked --thread task-abc                   # Unacked messages in specific thread
```

### Broadcast Messaging: Examples and Best Practices

Agent Mail supports broadcast messaging for multi-agent coordination. See `~/.claude/CLAUDE.md` for comprehensive broadcast documentation.

**Quick Examples:**

**1. Deploy coordination:**
```bash
am-send "Deploy: T-5min" \
  "Deployment starting in 5min. Pause work." \
  --from DeployBot --to @active --active-window 30 --importance urgent --ttl 600 --ack-required
```

**2. Project announcement:**
```bash
am-send "Feature ready" \
  "New API available in feature/user-auth branch." \
  --from Lead --to @project:jat --thread feature-user-auth
```

**3. Urgent all-hands:**
```bash
am-send "URGENT: Production down" \
  "All agents pause work immediately." \
  --from Monitor --to @all --importance urgent --ack-required --thread incident-2025
```

**4. Standup (short window):**
```bash
am-send "Standup in 5min" \
  "Daily standup starting soon." \
  --from Scrum --to @active --active-window 15 --ttl 600
```

**5. PR review (mixed recipients):**
```bash
am-send "PR review needed" \
  "Critical fix ready for review." \
  --from Dev --to @active,SeniorDev --thread pr-1234 --ack-required
```

**6. Checking and acknowledging:**
```bash
# Clean inbox view (hide acknowledged broadcasts)
am-inbox AgentName --unread --hide-acked

# Acknowledge broadcast
am-ack MSG_ID --agent AgentName

# Batch acknowledge all unread
am-inbox AgentName --unread --json | jq -r '.[].id' | xargs -I {} am-ack {} --agent AgentName
```

**Best Practices Summary:**
- **@active** for time-sensitive coordination (deployments, incidents)
- **@project:name** for project-specific updates
- **@all** only for critical system-wide alerts (use sparingly)
- Set appropriate TTLs: short (300-600s) for immediate, long (3600s+) for extended
- Use --ack-required for critical messages requiring confirmation
- Combine with thread_id for context and conversation tracking
- Use --active-window to control recipient freshness (default: 60 min)

**Common Patterns:**
```bash
# Deployment: Before, during, after
am-send "Deploy: T-5min" "..." --to @active --ttl 600 --ack-required
am-send "Deploy: In progress" "..." --to @active --thread deploy-X
am-send "Deploy: Complete" "..." --to @active --thread deploy-X

# Incident: Alert, updates, resolution
am-send "INCIDENT: DB down" "..." --to @all --ack-required --thread incident-X
am-reply MSG_ID "Update: investigating" --agent Lead
am-send "RESOLVED: DB restored" "..." --to @all --thread incident-X

# Handoff: Notify active + specific expert
am-send "Handoff needed" "..." --to @active,Expert --thread task-123
```

For complete broadcast documentation, examples, and detailed best practices, see: `~/.claude/CLAUDE.md` → "Broadcast Messaging: Examples and Best Practices"

## Database Tools

```bash
# Query database
db-query "SELECT * FROM users WHERE role='admin'"

# View schema
db-schema users

# Check active connections
db-sessions --active
```

## Browser Automation Tools

```bash
# Start browser
browser-start.js

# Navigate
browser-nav.js https://example.com

# Execute JavaScript
browser-eval.js "document.title"

# Take screenshot
browser-screenshot.js --fullpage

# Pick element selector
browser-pick.js

# Manage cookies
browser-cookies.js --set "auth=token123"

# Wait for elements
browser-wait.js --selector ".login-button" --timeout 10000
```

## Development Tools

```bash
# Type check
type-check-fast src/lib/components

# Lint staged files
lint-staged

# Check migrations
migration-status

# View component dependencies
component-deps src/lib/components/MediaSelector.svelte

# List routes
route-list --api

# Check build size
build-size

# Validate environment
env-check production
```

## Monitoring Tools

```bash
# View edge function logs
edge-logs video-generator --follow --errors

# Check API quota
quota-check --model openai-gpt4

# View error logs
error-log --level error --since 1h

# Monitor jobs
job-monitor --type video-generation

# Check performance
perf-check /api/chat
```

## Tool Documentation

Every tool has a `--help` flag:
```bash
am-send --help
db-query --help
browser-eval.js --help
type-check-fast --help
```

## Integration with Beads

Use Beads issue IDs (e.g., `task-abc`) as:
- Agent Mail `thread_id`
- File reservation `reason`
- Commit message references

```bash
# Example workflow
bd ready --json                                         # Pick work
/agent:start task-abc                                   # Registers + starts task
# ... do work ...
/agent:complete task-abc                                # Closes task
```

## Common Issues

### Dashboard themes not working
1. Check `dashboard/src/app.css` uses Tailwind v4 syntax
2. See `dashboard/CLAUDE.md` for detailed troubleshooting

### Agent Mail "not registered"
```bash
/agent:start              # Quick fix (auto-registers)
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

- **Dashboard docs**: `dashboard/CLAUDE.md`
- **Global Agent Mail docs**: `~/.claude/CLAUDE.md`
- **Agent commands**: `./commands/agent/*.md`
- **Tool source**: Each tool directory contains implementation
- **Installation**: `install.sh` for symlink setup
