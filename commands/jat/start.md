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
4. **Review prior tasks** - Check for duplicates and related work
5. **Start work** - Reserve files, update Beads, announce start
6. **Plan approach** - Analyze task, emit rich working signal

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
~/code/jat/tools/scripts/get-current-session-id
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
Without this, the IDE can't track your session.

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

### STEP 5: Review Prior Tasks (skip with quick mode)

**Search for related or duplicate work before starting.**

This step helps avoid duplicate effort and surfaces relevant context from recent work.

```bash
# Extract key terms from task title (remove common words)
TASK_TITLE="Your task title here"
# Search for tasks updated in last 7 days with similar keywords
DATE_7_DAYS_AGO=$(date -d '7 days ago' +%Y-%m-%d 2>/dev/null || date -v-7d +%Y-%m-%d)
bd search "$SEARCH_TERM" --updated-after "$DATE_7_DAYS_AGO" --limit 20 --json
```

**What to look for:**
- **Duplicates**: Tasks with nearly identical titles or descriptions → may already be done
- **Related work**: Tasks touching similar files/features → useful context or dependencies
- **Recent completions**: Recently closed tasks in same area → learn from their approach

**Output format** (if relevant tasks found):
```
┌─ RELATED TASKS (last 7 days) ───────────────────────────────────┐
│                                                                 │
│  Potential duplicates:                                          │
│    [CLOSED] jat-abc: Similar feature X                          │
│    → May already address this. Review before proceeding.        │
│                                                                 │
│  Related work:                                                  │
│    [CLOSED] jat-def: Refactored auth module                     │
│    → Touched same files. Check approach used.                   │
│                                                                 │
│    [IN_PROGRESS] jat-ghi: Auth improvements (by OtherAgent)     │
│    → Currently being worked on. Coordinate to avoid conflicts.  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Actions based on findings:**

1. **Potential duplicate found** (closed task with very similar title/goal):

   First, emit the `needs_input` signal:
   ```bash
   jat-signal needs_input '{
     "taskId": "jat-xyz",
     "question": "Found potential duplicate: jat-abc. Is this a duplicate, different scope, or incomplete?",
     "questionType": "duplicate_check",
     "options": ["duplicate", "different_scope", "incomplete"]
   }'
   ```

   Then ask the user using AskUserQuestion:
   ```
   Found potential duplicate: jat-abc "Similar feature X" [CLOSED]

   Options:
   1. This is a duplicate - close my task and reference jat-abc
   2. Different scope - proceed (explain how this differs)
   3. Incomplete - jat-abc didn't fully solve it, continue work
   ```

   **Wait for user response** before proceeding. After response, emit `working` signal to resume.

2. **Related closed task found** (similar area, useful context):
   - Read the task description with `bd show jat-xyz`
   - Note the approach used and files modified
   - Mention it in your approach: "Building on jat-xyz which did X..."
   - **Proceed to Step 6**

3. **Related in-progress task found** (another agent working on similar area):
   ```bash
   # Check their file reservations
   am-reservations --json | jq '.[] | select(.agent != "YourName")'

   # Send coordination message
   am-send "[jat-abc] Coordination" "Starting jat-xyz which touches similar files. Let me know if conflicts." \
     --from YourName --to OtherAgent --thread jat-abc
   ```
   - Wait for response or check reservations before proceeding
   - May need to pick a different task if files overlap

**If no relevant tasks found**, proceed to Step 6.

---

### STEP 6: Conflict Detection (skip with quick mode)

```bash
am-reservations --json          # Check file locks
git diff-index --quiet HEAD --  # Check uncommitted changes
bd show "$TASK_ID" --json | jq -r '.[0].dependencies[]'  # Check deps
```

---

### STEP 7: Start Task

```bash
bd update "$TASK_ID" --status in_progress --assignee "$AGENT_NAME"
am-reserve "relevant/files/**" --agent "$AGENT_NAME" --ttl 3600 --reason "$TASK_ID"
am-send "[$TASK_ID] Starting: $TASK_TITLE" "Starting work" --from "$AGENT_NAME" --to @active --thread "$TASK_ID"
```

---

### STEP 8: Emit Signals & Plan

**Starting signal** (with full session context for IDE display):
```bash
jat-signal starting '{
  "agentName": "AgentName",
  "sessionId": "abc123-...",
  "taskId": "jat-xyz",
  "taskTitle": "Task title",
  "project": "projectname",
  "model": "claude-opus-4-5-20251101",
  "tools": ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "WebSearch", "Task", "TodoWrite", "AskUserQuestion"],
  "gitBranch": "master",
  "gitStatus": "clean",
  "uncommittedFiles": []
}'
```

**Required fields:**
- `agentName` - Your assigned agent name
- `sessionId` - Claude Code session ID (from get-current-session-id)
- `project` - Project name (e.g., "jat", "chimaro")
- `model` - Full model ID (e.g., "claude-opus-4-5-20251101", "claude-sonnet-4-20250514")
- `tools` - Array of available tools in this session
- `gitBranch` - Current git branch name
- `gitStatus` - "clean" or "dirty"
- `uncommittedFiles` - Array of modified file paths (if dirty)

**Optional fields:**
- `taskId` - Task ID if starting on a specific task
- `taskTitle` - Task title if starting on a specific task

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

## Asking Questions During Work

**CRITICAL: Always emit `needs_input` signal BEFORE asking questions.**

When you need clarification from the user, follow this pattern:

### Step 1: Emit the signal FIRST
```bash
jat-signal needs_input '{
  "taskId": "jat-abc",
  "question": "Brief description of what you need",
  "questionType": "clarification"
}'
```

**Question types:**
- `clarification` - Need more details about requirements
- `decision` - User needs to choose between options
- `approval` - Confirming before a significant action
- `blocker` - Cannot proceed without this information
- `duplicate_check` - Found potential duplicate task

### Step 2: Ask using AskUserQuestion tool
```
Use the AskUserQuestion tool with your options
```

### Step 3: After response, emit working signal
```bash
jat-signal working '{
  "taskId": "jat-abc",
  "taskTitle": "Task title",
  "approach": "Updated approach based on user response..."
}'
```

### Common Examples

**Clarifying requirements:**
```bash
jat-signal needs_input '{
  "taskId": "jat-abc",
  "question": "Should the export include archived items?",
  "questionType": "clarification"
}'
```

**Choosing between approaches:**
```bash
jat-signal needs_input '{
  "taskId": "jat-abc",
  "question": "Two approaches possible: (1) Add new endpoint, (2) Extend existing. Which do you prefer?",
  "questionType": "decision",
  "options": ["new_endpoint", "extend_existing"]
}'
```

**Confirming destructive action:**
```bash
jat-signal needs_input '{
  "taskId": "jat-abc",
  "question": "This will delete 50 old records. Proceed?",
  "questionType": "approval"
}'
```

**Blocked on external dependency:**
```bash
jat-signal needs_input '{
  "taskId": "jat-abc",
  "question": "Need API credentials for the payment service. Can you provide?",
  "questionType": "blocker"
}'
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
IDE spawns agent
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

| Signal | State | When | Key Fields |
|--------|-------|------|------------|
| `jat-signal starting '{...}'` | Starting | After registration | agentName, model, gitBranch, gitStatus, tools |
| `jat-signal working '{...}'` | Working | After reading task | taskId, taskTitle, approach, expectedFiles |
| `jat-signal needs_input '{...}'` | Needs Input | Clarification needed | taskId, question, questionType |
| `jat-signal review '{...}'` | Ready for Review | Code complete | taskId, summary, filesModified |

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
