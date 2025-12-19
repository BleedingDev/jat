/**
 * Command Templates Configuration
 *
 * Starter templates for creating new slash commands.
 * Templates include YAML frontmatter, description section, and implementation patterns.
 *
 * @see dashboard/src/lib/components/config/CommandEditor.svelte
 * @see commands/jat/ for example implementations
 */

export interface CommandTemplate {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** Brief description of the template */
	description: string;
	/** Icon emoji for visual distinction */
	icon: string;
	/** Template content with placeholders */
	content: string;
	/** Default frontmatter values */
	frontmatter: {
		description?: string;
		author?: string;
		version?: string;
		tags?: string;
	};
	/** When to use this template */
	useCase: string;
}

/**
 * Basic Template
 *
 * Minimal structure with frontmatter and basic sections.
 * Good for simple commands or getting started.
 */
const basicTemplate: CommandTemplate = {
	id: 'basic',
	name: 'Basic',
	description: 'Minimal structure with frontmatter and description',
	icon: '📄',
	useCase: 'Simple commands, quick utilities, documentation-style commands',
	frontmatter: {
		description: '',
		author: '',
		version: '1.0.0',
		tags: ''
	},
	content: `---
description:
author:
version: 1.0.0
tags:
---

# Command Title

Brief description of what this command does.

## Usage

\`\`\`
/namespace:command [arguments]
\`\`\`

## What This Command Does

1. First action
2. Second action
3. Third action

## Examples

\`\`\`bash
# Basic usage
/namespace:command

# With arguments
/namespace:command arg1 arg2
\`\`\`

## Notes

- Important consideration 1
- Important consideration 2
`
};

/**
 * Workflow Template
 *
 * Step-by-step implementation pattern like /jat:start.
 * Includes implementation sections with bash code blocks.
 */
const workflowTemplate: CommandTemplate = {
	id: 'workflow',
	name: 'Workflow',
	description: 'Step-by-step pattern with implementation sections',
	icon: '⚡',
	useCase: 'Multi-step processes, agent workflows, complex operations',
	frontmatter: {
		description: '',
		author: '',
		version: '1.0.0',
		tags: 'workflow'
	},
	content: `---
description:
author:
version: 1.0.0
tags: workflow
argument-hint: [optional arguments]
---

# /namespace:command - Command Title

Brief one-line description of what this command does.

## Usage

\`\`\`
/namespace:command                    # Default behavior
/namespace:command arg1               # With argument
/namespace:command arg1 arg2          # Full usage
\`\`\`

---

## What This Command Does

1. **Step 1** - Description of first action
2. **Step 2** - Description of second action
3. **Step 3** - Description of third action

---

## Implementation Steps

### STEP 1: Parse Parameters

\`\`\`bash
PARAM="$1"   # First argument
PARAM2="$2"  # Second argument

# Validate inputs
if [[ -z "$PARAM" ]]; then
  echo "Usage: /namespace:command <required-arg>"
  exit 1
fi
\`\`\`

---

### STEP 2: Main Operation

\`\`\`bash
# Perform the main operation
echo "Processing: $PARAM"

# Add your implementation here
\`\`\`

---

### STEP 3: Output Results

\`\`\`bash
# Display results to user
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Operation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Result: $RESULT"
echo ""
\`\`\`

---

## Error Handling

**Error condition 1:**
\`\`\`
Error: Description of error
Fix: How to resolve it
\`\`\`

**Error condition 2:**
\`\`\`
Error: Another error type
Fix: Resolution steps
\`\`\`

---

## Quick Reference

\`\`\`bash
# Common usage patterns
/namespace:command arg1
/namespace:command arg1 arg2 --flag
\`\`\`
`
};

/**
 * Tool Template
 *
 * Bash tool wrapper with input/output/state documentation.
 * Following Mario Zechner's "prompts are code" pattern.
 */
const toolTemplate: CommandTemplate = {
	id: 'tool',
	name: 'Tool',
	description: 'Bash tool wrapper with I/O documentation',
	icon: '🔧',
	useCase: 'CLI tool wrappers, database operations, system utilities',
	frontmatter: {
		description: '',
		author: '',
		version: '1.0.0',
		tags: 'tool, utility'
	},
	content: `---
description:
author:
version: 1.0.0
tags: tool, utility
---

# tool-name

Brief description of what this tool does.

## Synopsis

\`\`\`bash
tool-name [OPTIONS] <required-arg>
tool-name --help
\`\`\`

## Description

**Input:**
- Required: \`<required-arg>\` - Description of required input
- Optional: \`--flag\` - Description of optional flag

**Output:**
- On success: Description of output (JSON, text, etc.)
- On error: Error message to stderr, exit code 1

**State:**
- Read-only / Read-write
- What it modifies (files, database, etc.)

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| \`--help\` | \`-h\` | Show help message | - |
| \`--verbose\` | \`-v\` | Enable verbose output | false |
| \`--output\` | \`-o\` | Output file path | stdout |
| \`--format\` | \`-f\` | Output format (json, text) | json |

## Examples

**Basic usage:**
\`\`\`bash
tool-name input-value
\`\`\`

**With options:**
\`\`\`bash
tool-name --verbose --format json input-value
\`\`\`

**Pipeline usage:**
\`\`\`bash
other-tool | tool-name --stdin | jq '.result'
\`\`\`

## Implementation

\`\`\`bash
#!/bin/bash
set -euo pipefail

# Parse arguments
VERBOSE=false
FORMAT="json"
OUTPUT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      echo "Usage: tool-name [OPTIONS] <input>"
      exit 0
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -f|--format)
      FORMAT="$2"
      shift 2
      ;;
    -o|--output)
      OUTPUT="$2"
      shift 2
      ;;
    *)
      INPUT="$1"
      shift
      ;;
  esac
done

# Validate input
if [[ -z "\${INPUT:-}" ]]; then
  echo "Error: Input required" >&2
  exit 1
fi

# Main logic
if [[ "$VERBOSE" == "true" ]]; then
  echo "Processing: $INPUT" >&2
fi

# Output result
RESULT="{\\"status\\": \\"success\\", \\"input\\": \\"$INPUT\\"}"

if [[ -n "$OUTPUT" ]]; then
  echo "$RESULT" > "$OUTPUT"
else
  echo "$RESULT"
fi
\`\`\`

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |

## Related Tools

- \`related-tool-1\` - Description
- \`related-tool-2\` - Description

## See Also

- Documentation link
- Related concept
`
};

/**
 * Agent Command Template
 *
 * Template for agent coordination commands (like /jat:start, /jat:complete).
 * Includes signal emissions, Agent Mail integration, and Beads coordination.
 */
const agentTemplate: CommandTemplate = {
	id: 'agent',
	name: 'Agent',
	description: 'Agent coordination with signals, mail, and Beads',
	icon: '🤖',
	useCase: 'Agent workflow commands, coordination, task management',
	frontmatter: {
		description: '',
		author: '',
		version: '1.0.0',
		tags: 'agent, workflow, coordination'
	},
	content: `---
description:
author:
version: 1.0.0
tags: agent, workflow, coordination
argument-hint: [task-id]
---

# /namespace:command - Agent Command Title

**What this command does in the agent workflow.**

## Usage

\`\`\`
/namespace:command                    # Default behavior
/namespace:command task-id            # With specific task
\`\`\`

---

## What This Command Does

1. **Check Agent Mail** - Read messages before taking action
2. **Validate State** - Ensure preconditions are met
3. **Perform Action** - Main operation
4. **Emit Signal** - Update dashboard state
5. **Coordinate** - Update Beads, reservations, send messages

---

## Implementation Steps

### STEP 1: Check Agent Mail

**ALWAYS check mail before starting any coordination action.**

\`\`\`bash
am-inbox "$AGENT_NAME" --unread
\`\`\`

- Read each message
- Reply if needed (\`am-reply\`)
- Acknowledge after reading: \`am-ack {msg_id} --agent "$AGENT_NAME"\`

---

### STEP 2: Validate Preconditions

\`\`\`bash
# Check if we have an active agent
AGENT_FILE=".claude/sessions/agent-\${SESSION_ID}.txt"
if [[ ! -f "$AGENT_FILE" ]]; then
  echo "Error: No agent registered. Run /jat:start first."
  exit 1
fi

AGENT_NAME=$(cat "$AGENT_FILE")
\`\`\`

---

### STEP 3: Perform Main Action

\`\`\`bash
# Your main implementation here
\`\`\`

---

### STEP 4: Emit Signal

**Update dashboard state via signal system.**

\`\`\`bash
jat-signal working '{"taskId":"task-id","taskTitle":"Task title"}'
\`\`\`

Available signals:
- \`starting\` - Agent initializing
- \`working\` - Actively working
- \`needs_input\` - Waiting for user
- \`review\` - Ready for review
- \`completing\` - Running completion
- \`completed\` - Task done
- \`idle\` - No active task

---

### STEP 5: Coordinate

\`\`\`bash
# Update Beads
bd update task-id --status in_progress --assignee "$AGENT_NAME"

# Reserve files
am-reserve "src/**/*.ts" --agent "$AGENT_NAME" --ttl 3600 --reason "task-id"

# Announce
am-send "[task-id] Starting: Task Title" \\
  "Brief message" \\
  --from "$AGENT_NAME" --to @active --thread "task-id"
\`\`\`

---

## Output Format

\`\`\`
╔════════════════════════════════════════════════════════╗
║               📋 COMMAND OUTPUT                        ║
╚════════════════════════════════════════════════════════╝

✅ Agent: {AGENT_NAME}
📋 Task: {TASK_TITLE}

┌─ DETAILS ───────────────────────────────────────────────┐
│  Key information here                                   │
└─────────────────────────────────────────────────────────┘
\`\`\`

---

## Error Handling

**No agent registered:**
\`\`\`
Error: No agent registered. Run /jat:start first.
\`\`\`

**Task not found:**
\`\`\`
Error: Task 'task-id' not found in Beads.
\`\`\`

---

## Related Commands

| Command | Purpose |
|---------|---------|
| \`/jat:start\` | Begin working |
| \`/jat:complete\` | Finish task |
| \`/jat:status\` | Check current state |
`
};

/**
 * All available command templates.
 */
export const COMMAND_TEMPLATES: CommandTemplate[] = [
	basicTemplate,
	workflowTemplate,
	toolTemplate,
	agentTemplate
];

/**
 * Get a template by ID.
 */
export function getTemplate(id: string): CommandTemplate | undefined {
	return COMMAND_TEMPLATES.find((t) => t.id === id);
}

/**
 * Apply template to create initial command content.
 *
 * Replaces placeholders with provided values.
 */
export function applyTemplate(
	template: CommandTemplate,
	options: {
		namespace?: string;
		name?: string;
		description?: string;
		author?: string;
	} = {}
): string {
	let content = template.content;

	// Replace namespace placeholder
	if (options.namespace) {
		content = content.replace(/namespace/g, options.namespace);
	}

	// Replace command name placeholder
	if (options.name) {
		content = content.replace(/command/g, options.name);
		content = content.replace(/tool-name/g, options.name);
		content = content.replace(/Command Title/g, `${options.name} - ${options.description || ''}`);
	}

	return content;
}
