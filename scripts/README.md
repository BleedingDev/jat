# Agent Tools Scripts

Helper scripts for agent orchestration workflows.

## get-agent-task.sh

**Purpose:** Get current task ID for an agent by checking both Beads and Agent Mail.

**Problem Solved:** Provides consistent agent status calculation between statusline and dashboard. Previously, the statusline only checked file reservations while the dashboard checked both Beads tasks and reservations, causing inconsistent status display.

### Algorithm

The script checks TWO sources (matching dashboard logic):

1. **Beads Database** - Check for `in_progress` tasks assigned to agent
2. **Agent Mail** - Check for active file reservations by agent

Returns task_id if found from **EITHER** source.

This matches the dashboard logic in `dashboard/src/lib/stores/agents.svelte.ts`:

```typescript
const hasInProgressTask = agent.in_progress_tasks > 0;
const hasActiveLocks = agent.reservation_count > 0;

if (hasInProgressTask || hasActiveLocks) {
    return 'working';
}
```

### Usage

```bash
# Get task ID for agent
task_id=$(./scripts/get-agent-task.sh FreeMarsh)

# Check if agent is working
if ./scripts/get-agent-task.sh FreeMarsh >/dev/null; then
    echo "Agent is working"
else
    echo "Agent is idle"
fi

# Use in statusline
task_id=$(./scripts/get-agent-task.sh "$agent_name")
if [[ -n "$task_id" ]]; then
    echo "Working on: $task_id"
fi
```

### Exit Codes

- `0` - Task found (prints task_id to stdout)
- `1` - No task found (agent is idle)
- `2` - Invalid usage (missing agent name)

### Examples

```bash
# Agent with in_progress task
$ ./scripts/get-agent-task.sh GreatLake
jat-a1z

# Agent with file reservation but no task
$ ./scripts/get-agent-task.sh FreeMarsh
jat-xyz

# Agent with no work
$ ./scripts/get-agent-task.sh PaleStar
$ echo $?
1
```

### Integration

**Statusline** (`.claude/statusline.sh`):
```bash
# Old approach (only checks reservations):
task_id=$(am-reservations --agent "$agent_name" | grep "^Reason:" | ...)

# New approach (checks both Beads and reservations):
task_id=$(./scripts/get-agent-task.sh "$agent_name")
```

**Dashboard** (`dashboard/src/lib/stores/agents.svelte.ts`):
Already implements this logic correctly (serves as reference implementation).

### Task ID Patterns

The script recognizes these task ID patterns from reservation reasons:
- `jat-abc` (Jomarchy Agent Tools)
- `bd-123` (Beads tasks)
- `task-xyz` (Generic tasks)

Pattern: `(jat|bd|task)-[a-z0-9]{3}\b`

### Dependencies

- `bd` command (Beads CLI)
- `am-reservations` command (Agent Mail)
- `jq` (for JSON parsing)

All dependencies are optional - script gracefully handles missing commands.
