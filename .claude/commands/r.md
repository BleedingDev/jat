# Resume Agent - Interactive Menu

**Usage:** `/r`

**What this command does:**
Shows an interactive menu of all registered agents, allowing you to explicitly choose which agent identity to resume. This is the "I want to see all my options" command.

**Key Features:**
- Always shows full agent list (no shortcuts)
- Displays agent details: task, reservations, last active time
- Sorted by last_active (most recent first)
- Clean UX for explicit choice
- Resuming existing agents only (no auto-create)

---

## Command Behavior

### When `/r` is Run:

**Step 1: Get All Agents**

Query all registered agents in the project:
```bash
AGENTS=$(am-agents --json)
AGENT_COUNT=$(echo "$AGENTS" | jq 'length')
```

**Step 2: Check if Agents Exist**

If `AGENT_COUNT == 0`:
```
╔══════════════════════════════════════════════════════════════════════════╗
║                    📭 No Agents Found                                    ║
╚══════════════════════════════════════════════════════════════════════════╝

No agents registered in this project yet.

💡 To create a new agent, use:
   • /start - Quick start with auto-detection
   • /agent:register - Full registration flow

```
Exit gracefully.

**Step 3: Get Agent Reservations**

Fetch all current file reservations to show which agents have active locks:
```bash
RESERVATIONS=$(am-reservations --json)
```

**Step 4: Build Agent Details**

For each agent, gather:
- Last active time (format as "X minutes/hours/days ago")
- Task description (if any)
- Active file reservations count
- Reservation details (file patterns being locked)

**Step 5: Present Interactive Menu**

Use `AskUserQuestion` to show agent selection menu:

```
Question: "Which agent identity would you like to resume?"
Header: "Resume Agent"
MultiSelect: false

Options (one per agent, max 4 shown):
  Option 1: "{AgentName}"
    Description: "Last active {time_ago}. Task: {task}. {reservation_count} active file locks."

  Option 2: "{AgentName2}"
    Description: "Last active {time_ago}. Task: {task}. No active reservations."

  ... (up to 4 most recent agents)
```

**Important:**
- Sort agents by `last_active_ts` (most recent first)
- If more than 4 agents, show top 4 most recent
- Show clear, actionable details in descriptions
- No "create new agent" option (use `/start` or `/agent:register` for that)

**Step 6: Register Selected Agent**

Once user selects an agent:
```bash
SELECTED_AGENT="{UserSelection}"
am-register --name $SELECTED_AGENT --program claude-code --model sonnet-4.5
```

**Step 7: Set Environment Variable for Statusline**

**CRITICAL:** Set the AGENT_NAME environment variable:
```bash
export AGENT_NAME=$SELECTED_AGENT
```

This enables the statusline to show your agent identity, task progress, and indicators.

**Step 8: Review Inbox**

```bash
# Get unread messages
UNREAD_MESSAGES=$(am-inbox $SELECTED_AGENT --unread --json)
UNREAD_COUNT=$(echo "$UNREAD_MESSAGES" | jq 'length')

# Acknowledge all messages
echo "$UNREAD_MESSAGES" | jq -r '.[].id' | \
  xargs -I {} am-ack {} --agent $SELECTED_AGENT
```

**Step 9: Get Ready Tasks**

```bash
READY_TASKS=$(bd ready --json)
READY_COUNT=$(echo "$READY_TASKS" | jq 'length')
```

**Step 10: Report to User**

Show completion summary:

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    ✅ RESUMED: {AgentName}                               ║
╚══════════════════════════════════════════════════════════════════════════╝

📬 Inbox: {X} messages acknowledged
📋 Ready tasks: {X} total
🔒 Active file reservations: {X}

┌─ AGENT CONTEXT ────────────────────────────────────────────────────────┐
│                                                                        │
│  Agent: {AgentName}                                                    │
│  Last active: {time_ago}                                               │
│  Current task: {task_description or "None"}                            │
│                                                                        │
│  Active file locks:                                                    │
│    • {pattern} (reason: {reason})                                      │
│    • {pattern} (reason: {reason})                                      │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ TOP PRIORITY TASKS ───────────────────────────────────────────────────┐
│                                                                        │
│  🎯 {task-id} (P{X}) - {title}                                         │
│  🎯 {task-id} (P{X}) - {title}                                         │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

💡 You're all set! Ready to work.
```

---

## Formatting Time Ago

Convert timestamps to human-readable format:

```bash
# Example helper function
time_ago() {
    local timestamp="$1"
    local now=$(date +%s)
    local then=$(date -d "$timestamp" +%s 2>/dev/null || echo "0")
    local diff=$((now - then))

    if [ $diff -lt 60 ]; then
        echo "just now"
    elif [ $diff -lt 3600 ]; then
        echo "$((diff / 60)) minutes ago"
    elif [ $diff -lt 86400 ]; then
        echo "$((diff / 3600)) hours ago"
    else
        echo "$((diff / 86400)) days ago"
    fi
}
```

---

## Example Session

```
User runs: /r

System shows menu:
╔══════════════════════════════════════════════════════════════════════════╗
║                    🔄 Resume Agent Identity                              ║
╚══════════════════════════════════════════════════════════════════════════╝

Found 8 registered agents in this project. Select one to resume:

Which agent identity would you like to resume?

  1. ShortTundra
     Last active 2 minutes ago. Task: Working on 91q. 1 active file lock.

  2. PaleStar
     Last active 15 minutes ago. Task: None. No active reservations.

  3. FreeMarsh
     Last active 20 minutes ago. Task: Testing. 2 active file locks.

  4. StrongShore
     Last active 35 minutes ago. Task: Dashboard work. 2 active file locks.

User selects: ShortTundra

System responds:
✅ RESUMED: ShortTundra
📬 Inbox: 0 messages
📋 Ready tasks: 8 total
🔒 Active file reservations: 1

Ready to work!
```

---

## Why This Design?

**Clear separation of concerns:**
- `/start` = "Just get me working" (auto-detect or quick-create)
- `/r` = "Show me all agents so I can choose" (explicit selection)
- `/agent:register` = "Full registration with review" (complete workflow)

**Benefits:**
- **Explicit choice:** User sees all options before deciding
- **Context awareness:** Shows what each agent was doing
- **Conflict avoidance:** Displays file locks to prevent stepping on other agents
- **Clean UX:** No confusing shortcuts or automatic behaviors
- **Resume-only:** Focused on resuming existing work, not creating new agents

---

## Comparison with Other Commands

| Command | Use Case | Behavior |
|---------|----------|----------|
| `/r` | "Let me see all agents and pick one" | Shows menu, user selects, resumes |
| `/start` | "Just get me working ASAP" | Auto-detects recent or creates new |
| `/start AgentName` | "Resume specific agent quickly" | Direct registration |
| `/agent:register` | "Full review and registration" | Complete workflow with task review |

---

## Notes

- **No arguments:** `/r` takes no arguments (always shows menu)
- **No auto-create:** If you want a new agent, use `/start` or `/agent:register`
- **Maximum clarity:** Shows all relevant context before user chooses
- **Conflict prevention:** Displays file reservations to avoid coordination issues
- **Statusline integration:** Sets `AGENT_NAME` for rich terminal UI
