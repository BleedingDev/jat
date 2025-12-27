---
argument-hint: [agent-name | task-id | agent-name task-id]
---

# /jat:start - Begin Working

**One agent = one session = one task.** Each Claude session handles exactly one task from start to completion.

## Usage

```
/jat:start                      # Create agent, show available tasks
/jat:start task-id              # Create agent, start that task
/jat:start AgentName            # Resume as AgentName, show tasks
/jat:start AgentName task-id    # Resume as AgentName, start task
```

**Quick mode** (skip conflict checks): Add `quick` to any command.

---

## What This Command Does

1. **Register agent** - Create new or resume existing
2. **Check Agent Mail** - Read messages before starting work
3. **Select task** - From parameter or show recommendations
4. **Start work** - Reserve files, update Beads, announce start
5. **Plan approach** - Analyze task, emit rich working signal

---

## Implementation Steps

### STEP 1: Parse Parameters

Detect what was passed: task-id, agent-name, both, or none.

```bash
# Check if param is a valid task
bd show "$PARAM" --json >/dev/null 2>&1 && PARAM_TYPE="task-id"
```

---

### STEP 2: Get/Create Agent

#### 2A: Get Session ID
```bash
~/code/jat/scripts/get-current-session-id
```

#### 2B: Register Agent
```bash
# If agent exists, resume it
am-agents | grep -q "^  ${REQUESTED_AGENT}$" && echo "Resuming: $REQUESTED_AGENT"

# Otherwise create new
am-register --name "$REQUESTED_AGENT" --program claude-code --model sonnet-4.5
```

#### 2C: Write Session File
```bash
mkdir -p .claude/sessions
# Use Write tool: Write(.claude/sessions/agent-{session_id}.txt, "AgentName")
```

#### 2D: Rename tmux Session (CRITICAL)
```bash
tmux rename-session "jat-{AgentName}"
```
Without this, the dashboard can't track your session.

---

### STEP 3: Check Agent Mail

**ALWAYS do this before selecting a task.**

```bash
am-inbox "$AGENT_NAME" --unread
```

Read, reply if needed, then acknowledge: `am-ack {msg_id} --agent "$AGENT_NAME"`

---

### STEP 4: Select Task

**If task-id provided** → continue to Step 5

**If no task-id** → show recommendations and EXIT:

```bash
bd ready --json | jq -r '.[] | "  [\(.priority)] \(.id) - \(.title)"'
```

---

### STEP 5: Conflict Detection (skip with quick mode)

```bash
am-reservations --json          # Check file locks
git diff-index --quiet HEAD --  # Check uncommitted changes
bd show "$TASK_ID" --json | jq -r '.[0].dependencies[]'  # Check deps
```

---

### STEP 6: Start Task

```bash
bd update "$TASK_ID" --status in_progress --assignee "$AGENT_NAME"
am-reserve "relevant/files/**" --agent "$AGENT_NAME" --ttl 3600 --reason "$TASK_ID"
am-send "[$TASK_ID] Starting: $TASK_TITLE" "Starting work" --from "$AGENT_NAME" --to @active --thread "$TASK_ID"
```

---

### STEP 7: Emit Signals & Plan

**Starting signal** (with session info):
```bash
jat-signal starting '{"agentName":"...","sessionId":"...","taskId":"...","taskTitle":"...","project":"..."}'
```

**Working signal** (with approach):
```bash
jat-signal working '{
  "taskId": "jat-123",
  "taskTitle": "Add user auth",
  "approach": "Implement OAuth via Supabase, add login page, protect routes",
  "expectedFiles": ["src/lib/auth/*", "src/routes/login/*"],
  "baselineCommit": "abc123"
}'
```

Then output the banner:
```
╔════════════════════════════════════════════════════════╗
║         🚀 STARTING WORK: {TASK_ID}                    ║
╚════════════════════════════════════════════════════════╝

✅ Agent: {AGENT_NAME}
📋 Task: {TASK_TITLE}
🎯 Priority: P{X}

┌─ APPROACH ──────────────────────────────────────────────┐
│  {YOUR_APPROACH_DESCRIPTION}                            │
└─────────────────────────────────────────────────────────┘
```

---

## When You Finish Working

**You MUST emit a `review` signal when done.**

```bash
jat-signal review '{
  "taskId": "jat-abc",
  "taskTitle": "Add feature X",
  "summary": ["Implemented X", "Added tests"],
  "filesModified": [
    {"path": "src/x.ts", "changeType": "added", "linesAdded": 100, "linesRemoved": 0}
  ],
  "testsStatus": "passing",
  "buildStatus": "clean",
  "reviewFocus": ["Check error handling"]
}'
```

Then output:
```
┌────────────────────────────────────────────────────────┐
│  🔍 READY FOR REVIEW: {TASK_ID}                        │
└────────────────────────────────────────────────────────┘

📋 Summary:
  • [accomplishment 1]
  • [accomplishment 2]

Run /jat:complete when ready to close this task.
```

**Do NOT say "Task Complete"** until the user runs `/jat:complete`.

---

## Session Lifecycle

```
Dashboard spawns agent
       │
       ▼
  ┌──────────┐
  │ STARTING │  /jat:start
  └────┬─────┘
       │ jat-signal working
       ▼
  ┌──────────┐      ┌─────────────┐
  │ WORKING  │◄────►│ NEEDS INPUT │
  └────┬─────┘      └─────────────┘
       │ jat-signal review
       ▼
  ┌──────────┐
  │  REVIEW  │  Code done, awaiting user
  └────┬─────┘
       │ /jat:complete
       ▼
  ┌──────────┐
  │   DONE   │  Task closed, session ends
  └──────────┘

To work on another task → spawn new agent
```

---

## Signal Reference

| Signal | State | When |
|--------|-------|------|
| `jat-signal starting '{...}'` | Starting | After registration |
| `jat-signal working '{...}'` | Working | After reading task |
| `jat-signal needs_input '{...}'` | Needs Input | Clarification needed |
| `jat-signal review '{...}'` | Ready for Review | Code complete |

---

## Error Handling

**Task not found:**
```
Error: Task 'invalid-id' not found in Beads
Use 'bd list' to see available tasks
```

**Reservation conflict:**
```
⚠️ File conflict: src/**/*.ts reserved by OtherAgent (expires in 30 min)
Options: Wait, contact OtherAgent, or choose different task
```
