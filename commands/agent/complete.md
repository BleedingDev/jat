---
argument-hint: [continue | stop | pause]
---

Complete a task following best practices - update documentation, commit changes, notify collaborators, and mark task complete.

# Complete Task

**Usage:**
- `/complete_task` or `/complete_task continue` - Auto-start next task (continuous workflow)
- `/complete_task stop` or `/complete_task pause` - Complete current task and stop (show options)

---

Follow these steps in order:

## PART 0: Verification Gate (Always Execute First)

**Run `/verify` command to validate work quality before completion:**

1. **Determine verification mode:**
   - If changes affect browser/UI (Svelte components, routes, styles): Use `full` mode
   - If changes are backend-only (API routes, database, utilities): Use `quick` mode

2. **Execute verification:**
   ```bash
   /verify full    # For UI/browser changes
   /verify quick   # For backend/non-UI changes
   ```

3. **Handle verification results:**

   **✅ VERIFICATION PASSED:**
   - Proceed to PART 1 (Complete Current Task)
   - Include verification summary in completion report

   **❌ VERIFICATION FAILED:**
   - **DO NOT PROCEED TO PART 1**
   - Task stays OPEN (do not close in Beads)
   - Do not release file reservations yet
   - **Self-Correction Loop:**

     **Option 1: Self-Fix (for simple issues)**
     - Review verification errors
     - Fix issues immediately
     - Re-run `/verify` to confirm fixes
     - If passes: Proceed to PART 1

     **Option 2: Call Refactorer (for complex issues)**
     - Launch code-refactorer agent with context
     - Provide verification errors and files affected
     - Let refactorer fix and re-verify
     - If passes: Proceed to PART 1

     **Option 3: Report Blocker (if cannot fix)**
     - Use `/block "verification failing: [specific issue]"`
     - Document what's failing and why
     - Request help via Agent Mail

**CRITICAL:** Do not mark task complete or proceed if verification fails!

---

## PART 1: Complete Current Task (Execute Only After Verification Passes)

1. Release any file reservations held during work
2. Update CLAUDE.md with new features/changes (if applicable)
3. Update README or component-specific documentation (if applicable)
4. Create meaningful git commit(s) with descriptive messages
5. Reference Beads task ID in commit message
6. Mark Beads task as completed with completion reason
7. Send completion message to Agent Mail thread with summary
8. Acknowledge any pending messages in inbox
9. Report completion summary to console (see format below)

### Implementation for Step 8: Acknowledge Messages

**Auto-acknowledge messages related to the completed task:**

```bash
# Get current task ID from context or parameter
TASK_ID="[completed-task-id]"  # e.g., jat-abc

# Find unread messages in the task thread
UNREAD_IN_THREAD=$(am-inbox "$AGENT_NAME" --unread --json 2>/dev/null | \
    jq -r --arg thread "$TASK_ID" '.[] | select(.thread_id == $thread) | .id')

# Count messages to acknowledge
UNREAD_COUNT=$(echo "$UNREAD_IN_THREAD" | grep -c . || echo "0")

# Auto-acknowledge all messages in the completed task thread
if [[ "$UNREAD_COUNT" -gt 0 ]]; then
    echo "📬 Acknowledging $UNREAD_COUNT message(s) in task thread..."

    for msg_id in $UNREAD_IN_THREAD; do
        am-ack "$msg_id" --agent "$AGENT_NAME" >/dev/null 2>&1
    done

    echo "  ✓ Acknowledged $UNREAD_COUNT message(s)"
fi

# Also acknowledge any @mentions or urgent messages (not in task thread)
UNREAD_MENTIONS=$(am-inbox "$AGENT_NAME" --unread --json 2>/dev/null | \
    jq -r --arg agent "$AGENT_NAME" '.[] | select(.to_agents | contains($agent)) | select(.importance == "urgent" or .importance == "high") | .id')

MENTION_COUNT=$(echo "$UNREAD_MENTIONS" | grep -c . || echo "0")

if [[ "$MENTION_COUNT" -gt 0 ]]; then
    echo "📬 Found $MENTION_COUNT urgent/high-priority message(s)..."

    for msg_id in $UNREAD_MENTIONS; do
        am-ack "$msg_id" --agent "$AGENT_NAME" >/dev/null 2>&1
    done

    echo "  ✓ Acknowledged $MENTION_COUNT urgent message(s)"
fi
```

**Rationale:**
- Auto-ack messages in the completed task thread (no longer relevant)
- Auto-ack urgent/high-priority direct mentions (acknowledge you saw them)
- Leaves low-priority informational messages unread for manual review
- Prevents inbox buildup while keeping important messages visible

---

## PART 1.5: Feature Completion Detection & PR Creation (Automatic)

**After completing a task, detect if a feature is complete and auto-create PR:**

### Detection Logic

Check if conditions indicate feature completion:

1. **Multiple related tasks completed:**
   ```bash
   # Get tasks completed in last 24-48 hours
   recent_tasks=$(bd list --status completed --json | jq -r '.[] | select(.updated_at > (now - 172800))')

   # Count related tasks (same feature tag, epic, or prefix)
   related_count=$(analyze_task_relationships "$recent_tasks")
   ```

2. **Commit count on current branch:**
   ```bash
   commits=$(git log main..HEAD --oneline | wc -l)
   # If 3-15 commits: likely feature-sized work
   ```

3. **Task has feature label:**
   ```bash
   task_labels=$(bd show "$current_task" --json | jq -r '.labels[]')
   # If contains "feature", "epic", or similar
   ```

### Decision Point

**If ANY of these conditions are true:**
- 3+ related tasks completed in last 48 hours
- Current branch has 3-15 commits since main
- Task has "feature" or "epic" label
- Multiple tasks share same prefix (e.g., "stripe-", "auth-")

**Then: AUTO-CREATE PR**

```bash
# Call /pr command to create pull request
/pr
```

**The `/pr` command will:**
- Auto-detect all related tasks from commits
- Generate PR title from task titles
- Build comprehensive PR body with task links, commits, changes
- Create PR using GitHub CLI
- Link PR back to tasks
- Announce in Agent Mail

### If PR Created

Update completion output to include PR information (see updated format below).

### If No PR Needed

Skip this section and proceed directly to PART 2.

---

**IMPORTANT:** PR creation is automatic when feature completion is detected. This keeps the workflow efficient. If you need to skip PR creation, use `/complete stop` instead.

---

## PART 2: Next Task Decision (Conditional)

**Check the command argument (`$1`):**

- If `$1` is empty, "continue", or any value other than "stop"/"pause":
  - **Execute steps 10-14 below** (auto-start next task)

- If `$1` is "stop" or "pause":
  - **Skip steps 10-14** and use the "STOP MODE" output format instead
  - Show available next tasks but DO NOT auto-start

### Steps 10-14 (Auto-Start Mode - Execute Unless Stopped)

10. Run `bd ready --json` to find next highest priority task
11. **Pick the top priority task** (P0 > P1 > P2, then by creation date)
12. Reserve files for the new task as appropriate
13. Send announcement message to Agent Mail about starting new task
14. **START WORK IMMEDIATELY** on the new task

**CRITICAL**: Do NOT stop at recommending - actually start the next task! This keeps the workflow continuous.

---

## Output Format - CONTINUE MODE

Use this format when auto-starting next task (default behavior):

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    📋 TASK COMPLETION PROTOCOL                           ║
║                                                                          ║
║                    🤖 Agent: [YOUR-AGENT-NAME]                           ║
╚══════════════════════════════════════════════════════════════════════════╝

📌 Task ID: [task-id]
📝 Title: [task title]
⏱️  Duration: [time spent if known]

┌─ VERIFICATION ─────────────────────────────────────────────────────────┐
│                                                                        │
│  ✅ Mode: [quick | full]                                               │
│  ✅ Type Checking: PASSED                                              │
│  ✅ Linting: PASSED                                                    │
│  ✅ Security Scan: PASSED                                              │
│  [If full mode:]                                                       │
│  ✅ Browser Testing: PASSED                                            │
│  ✅ Console Errors: 0                                                  │
│  ✅ Network Requests: All successful                                   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ WORK COMPLETED ───────────────────────────────────────────────────────┐
│                                                                        │
│  • [Key accomplishment 1]                                              │
│  • [Key accomplishment 2]                                              │
│  • [Key accomplishment 3]                                              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ FILES MODIFIED ───────────────────────────────────────────────────────┐
│                                                                        │
│  📄 [file1.svelte] - [description]                                     │
│  📄 [file2.ts] - [description]                                         │
│  📋 CLAUDE.md - [documentation added]                                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ COMMITS ──────────────────────────────────────────────────────────────┐
│                                                                        │
│  🔹 [commit-hash] - [commit message 1]                                 │
│  🔹 [commit-hash] - [commit message 2]                                 │
│  🔹 [commit-hash] - [commit message 3]                                 │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ IMPACT & BENEFITS ────────────────────────────────────────────────────┐
│                                                                        │
│  ✨ [Benefit 1]                                                        │
│  ✨ [Benefit 2]                                                        │
│  ✨ [Benefit 3]                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

[If PR was created in PART 1.5:]

┌─ PULL REQUEST CREATED ─────────────────────────────────────────────────┐
│                                                                        │
│  🎯 PR #[number]: [title]                                              │
│  🔗 [GitHub PR URL]                                                    │
│                                                                        │
│  📋 Includes [X] tasks:                                                │
│     • dirt-abc - [task title 1]                                        │
│     • dirt-def - [task title 2]                                        │
│     • dirt-ghi - [task title 3]                                        │
│                                                                        │
│  📊 [X] commits, [Y] files changed                                     │
│  ✅ Ready for review                                                   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════╗
║              🏁✨📋✅ TASK COMPLETE - CONTINUING FLOW ✨📋✅🏁          ║
║                                                                          ║
║                       	📌 Completed: [task-id]						   ║
║                       	📝 [completed task title]					   ║
║                                                                          ║
║ 	                     🤖 Agent: [YOUR-AGENT-NAME]    					║
║																			║
╚══════════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════════╗
║                    🚀 STARTING NEXT TASK IMMEDIATELY                     ║
╚══════════════════════════════════════════════════════════════════════════╝

📌 Task ID: [next-task-id from bd ready]
📝 Title: [next task title]
🔥 Priority: P[X]

┌─ WHY THIS TASK NEXT ───────────────────────────────────────────────────┐
│                                                                        │
│  1. [Reason 1 - highest priority/impact]                               │
│  2. [Reason 2 - dependencies/blocking]                                 │
│  3. [Reason 3 - business value]                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ FILE RESERVATIONS ────────────────────────────────────────────────────┐
│                                                                        │
│  🔒 [path/pattern] - [TTL: X hours] - [reason]                         │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ ALTERNATIVE TASKS (if current becomes blocked) ───────────────────────┐
│                                                                        │
│  • [task-id] (P[X]) - [brief description]                              │
│  • [task-id] (P[X]) - [brief description]                              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║                   🚀✅🔒 WORKING ON NEXT TASK NOW 🚀✅🔒                ║
║                                                                          ║
║                       	📌 Task ID: [next-task-id]						║
║                       	📝 Title: [next task title]					║
║																			║
║ 	                     🤖 Agent: [YOUR-AGENT-NAME]    					║
║																			║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## Output Format - STOP MODE

Use this format when stopping after completion (when `$1` is "stop" or "pause"):

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    📋 TASK COMPLETION PROTOCOL                           ║
║                                                                          ║
║                    🤖 Agent: [YOUR-AGENT-NAME]                           ║
╚══════════════════════════════════════════════════════════════════════════╝

📌 Task ID: [task-id]
📝 Title: [task title]
⏱️  Duration: [time spent if known]

┌─ VERIFICATION ─────────────────────────────────────────────────────────┐
│                                                                        │
│  ✅ Mode: [quick | full]                                               │
│  ✅ Type Checking: PASSED                                              │
│  ✅ Linting: PASSED                                                    │
│  ✅ Security Scan: PASSED                                              │
│  [If full mode:]                                                       │
│  ✅ Browser Testing: PASSED                                            │
│  ✅ Console Errors: 0                                                  │
│  ✅ Network Requests: All successful                                   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ WORK COMPLETED ───────────────────────────────────────────────────────┐
│                                                                        │
│  • [Key accomplishment 1]                                              │
│  • [Key accomplishment 2]                                              │
│  • [Key accomplishment 3]                                              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ FILES MODIFIED ───────────────────────────────────────────────────────┐
│                                                                        │
│  📄 [file1.svelte] - [description]                                     │
│  📄 [file2.ts] - [description]                                         │
│  📋 CLAUDE.md - [documentation added]                                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ COMMITS ──────────────────────────────────────────────────────────────┐
│                                                                        │
│  🔹 [commit-hash] - [commit message 1]                                 │
│  🔹 [commit-hash] - [commit message 2]                                 │
│  🔹 [commit-hash] - [commit message 3]                                 │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ IMPACT & BENEFITS ────────────────────────────────────────────────────┐
│                                                                        │
│  ✨ [Benefit 1]                                                        │
│  ✨ [Benefit 2]                                                        │
│  ✨ [Benefit 3]                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

[If PR was created in PART 1.5:]

┌─ PULL REQUEST CREATED ─────────────────────────────────────────────────┐
│                                                                        │
│  🎯 PR #[number]: [title]                                              │
│  🔗 [GitHub PR URL]                                                    │
│                                                                        │
│  📋 Includes [X] tasks:                                                │
│     • dirt-abc - [task title 1]                                        │
│     • dirt-def - [task title 2]                                        │
│     • dirt-ghi - [task title 3]                                        │
│                                                                        │
│  📊 [X] commits, [Y] files changed                                     │
│  ✅ Ready for review                                                   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════╗
║                      🏁✨📋✅ TASK COMPLETE ✨📋✅🏁                    ║
║                                                                          ║
║                       	📌 Completed: [task-id]						   ║
║                       	📝 [completed task title]					   ║
║                                                                          ║
║ 	                     🤖 Agent: [YOUR-AGENT-NAME]    					║
║																			║
╚══════════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════════╗
║                        ⏸️  WORKFLOW PAUSED                               ║
╚══════════════════════════════════════════════════════════════════════════╝

📋 Available Next Tasks (from `bd ready`)

┌─ HIGH PRIORITY ────────────────────────────────────────────────────────┐
│                                                                        │
│  🔴 [task-id] (P0) - [description]                                     │
│  🟠 [task-id] (P1) - [description]                                     │
│  🟡 [task-id] (P2) - [description]                                     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

💡 Next Steps:
   • Use `/start [task-id]` to resume with a specific task
   • Use `/start` to auto-select and begin the highest priority task
   • Review task details with `bd show [task-id]`

╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║                         ⏸️  AWAITING YOUR COMMAND  ⏸️                   ║
║                                                                          ║
║ 	                     🤖 Agent: [YOUR-AGENT-NAME]    					║
║																			║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

**IMPORTANT:**
- Always show your agent name at the top and bottom
- The completion marker confirms all required completion steps were executed
- In CONTINUE mode: The start marker confirms the next task was automatically started
- In STOP mode: Show available options and wait for user command
