# Beads Tools

## Overview

This directory contains CLI tools for Beads task management.

---

## Review Rules Management

Configure which tasks auto-proceed vs require human review on completion.

### bd-review-rules

Manage review rules that determine task completion behavior.

```bash
# Show all current rules
bd-review-rules

# Set max auto-proceed priority for a type
bd-review-rules --type bug --max-auto 1    # P0-P1 bugs auto, P2-P4 review

# Show rule for specific type
bd-review-rules --type feature

# Set default action for unconfigured types
bd-review-rules --default auto             # Default to auto-proceed

# Reset all rules to defaults
bd-review-rules --reset
```

#### Configuration Schema

Rules are stored in two places (automatically synced):
1. **`bd config`** key-value pairs (for CLI access)
2. **`.beads/review-rules.json`** (human-readable, version-controllable)

##### JSON File Schema (v1)

```json
{
  "version": 1,
  "defaultAction": "review",
  "priorityThreshold": 3,
  "rules": [
    { "type": "bug", "maxAutoPriority": 3, "note": "P0-P3 auto" },
    { "type": "feature", "maxAutoPriority": 3 },
    { "type": "epic", "maxAutoPriority": -1, "note": "Always review" }
  ],
  "overrides": [
    { "taskId": "jat-abc", "action": "always_review", "reason": "Security" }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | Schema version (currently 1) |
| `defaultAction` | string | Default: `review` or `auto` |
| `priorityThreshold` | number | Global fallback (0-4) |
| `rules[].type` | string | `bug`, `feature`, `task`, `chore`, `epic` |
| `rules[].maxAutoPriority` | number | -1 to 4 |
| `rules[].note` | string | Optional explanation |
| `overrides[].taskId` | string | Task ID to override |
| `overrides[].action` | string | `always_review` or `always_auto` |
| `overrides[].reason` | string | Optional explanation |

##### bd config Keys

Rules are also stored as `bd config` key-value pairs:

| Key | Values | Description |
|-----|--------|-------------|
| `review_rules.default_action` | `review` or `auto` | Default when no type rule matches |
| `review_rules.<type>.max_auto` | `-1` to `4` | Max priority that auto-proceeds |

Types: `bug`, `feature`, `task`, `chore`, `epic`

#### Priority Thresholds

- `max_auto = 3` → P0-P3 auto-proceed, P4 requires review
- `max_auto = 1` → P0-P1 auto-proceed, P2-P4 require review
- `max_auto = -1` → All priorities require review
- `max_auto = 4` → All priorities auto-proceed

### bd-review-rules-loader

Low-level tool for managing `.beads/review-rules.json` directly.

```bash
# Load rules (creates defaults if missing)
bd-review-rules-loader

# Initialize with default rules
bd-review-rules-loader --init

# Validate existing rules file
bd-review-rules-loader --validate

# Sync JSON to bd config
bd-review-rules-loader --sync-to-config

# Sync bd config to JSON
bd-review-rules-loader --sync-from-config

# Get maxAutoPriority for a type
bd-review-rules-loader --get bug           # Returns: 3

# Get override for a task
bd-review-rules-loader --get-override jat-abc  # Returns: always_review or none

# Output as JSON
bd-review-rules-loader --json
```

**Note:** Changes made via `bd-review-rules` are automatically synced to the JSON file. The loader is primarily for:
- Direct JSON file manipulation
- Schema migration between versions
- Programmatic access to rules

### bd-check-review

Preview what review action would be taken for a task.

```bash
# Check single task
bd-check-review jat-abc

# JSON output
bd-check-review jat-xyz --json

# Check all open/in_progress tasks
bd-check-review --batch
```

#### Example Output

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    🔍 Review Check: jat-abc                              ║
╚══════════════════════════════════════════════════════════════════════════╝

  Task: Fix authentication timeout
  Type: bug
  Priority: P2 (Medium)
  Status: in_progress

  Rule applied:
    Source: Type rule (review_rules.bug.max_auto = 1)

  ┌────────────────────────────────────────────────────────────────────────┐
  │  👁 DECISION: REQUIRES REVIEW                                          │
  │                                                                        │
  │  This task will wait for human review before closing.                  │
  │                                                                        │
  │  Reason: Priority P2 > max_auto P1 for type 'bug'                     │
  └────────────────────────────────────────────────────────────────────────┘

  To change this behavior:
    • Increase max_auto: bd-review-rules --type bug --max-auto 2
    • Set task override: bd update jat-abc --review-override always_auto
```

---

## Migration Tools

Three complementary tools for safe Beads database backup, migration, and rollback:

1. **backup-beads.sh** - Standalone backup utility
2. **rollback-beads.sh** - Restore from backup
3. **beads-migrate-prefix.sh** - Full migration with integrated backup

---

## backup-beads.sh

Standalone utility to create timestamped backups of Beads and Agent Mail databases.

### Usage

```bash
# Basic backup
./tools/backup-beads.sh --project ~/code/chimaro

# Labeled backup (for specific purpose)
./tools/backup-beads.sh --project ~/code/chimaro --label "before-migration"

# Backup with integrity verification
./tools/backup-beads.sh --project ~/code/chimaro --verify
```

### Features

- Timestamped backup directories
- SHA256 checksum verification
- Metadata file with backup details
- Optional integrity verification
- Backs up both Beads and Agent Mail databases

### Backup Location

```
<project>/.beads/backups/backup_<timestamp>[_<label>]/
  ├── beads.db.backup
  ├── beads.db.sha256
  ├── agent-mail.db.backup (if exists)
  ├── agent-mail.db.sha256 (if exists)
  └── metadata.txt
```

### Options

| Option | Description |
|--------|-------------|
| `--project PATH` | Path to Beads project (required) |
| `--label LABEL` | Optional label for backup |
| `--verify` | Verify backup integrity after creation |
| `--help` | Show help message |
| `--version` | Show version information |

---

## rollback-beads.sh

Restore Beads and Agent Mail databases from a backup.

### Usage

```bash
# Restore with confirmation prompt
./tools/rollback-beads.sh --backup ~/code/chimaro/.beads/backups/backup_20231124_123456

# Restore with integrity verification
./tools/rollback-beads.sh --backup <backup-dir> --verify

# Restore without confirmation (automated)
./tools/rollback-beads.sh --backup <backup-dir> --force
```

### Safety Features

- **Checksum verification** (optional with `--verify`)
- **Confirmation prompt** (skip with `--force`)
- **Safety backup** of current state before restoring
- Validates backup directory structure
- Detailed rollback instructions

### Pre-Rollback Safety Backup

Before restoring, creates safety backup of current state:

```
<backup-dir>/pre-rollback_<timestamp>/
  ├── beads.db.current
  ├── beads.db.sha256
  ├── agent-mail.db.current (if exists)
  └── agent-mail.db.sha256 (if exists)
```

This ensures you can recover if rollback doesn't work as expected.

### Options

| Option | Description |
|--------|-------------|
| `--backup PATH` | Path to backup directory (required) |
| `--verify` | Verify backup integrity before restoring |
| `--force` | Skip confirmation prompt |
| `--help` | Show help message |
| `--version` | Show version information |

---

## beads-migrate-prefix.sh

Migrate Beads task ID prefixes across all related databases and files.

### Features

- **Safe Migration**: Automatic backup creation with SHA256 checksums
- **Atomic Updates**: Uses SQLite transactions (all-or-nothing)
- **Dry-Run Mode**: Preview changes without modifying data
- **Comprehensive**: Updates Beads DB, Agent Mail, and file reservations
- **Validated**: Pre and post-migration validation checks
- **Color Output**: Clear, color-coded logging for easy monitoring

### What It Migrates

1. **Beads Database** (`beads.db`)
   - Task IDs in `issues` table
   - References in `dependencies.issue_id`
   - References in `dependencies.depends_on_id`

2. **Agent Mail Database** (`~/.agent-mail.db`)
   - Thread IDs in `messages.thread_id`
   - Task references in `file_reservations.reason`

3. **Preserves**
   - All metadata and timestamps
   - Task relationships (dependencies)
   - Message history and threads

### Usage

```bash
# Preview migration (recommended first step)
./tools/beads-migrate-prefix.sh \
  --from dirt \
  --to chimaro \
  --project ~/code/chimaro \
  --dry-run

# Execute migration
./tools/beads-migrate-prefix.sh \
  --from dirt \
  --to chimaro \
  --project ~/code/chimaro
```

### Options

| Option | Description | Required |
|--------|-------------|----------|
| `--from PREFIX` | Old prefix to migrate from (e.g., `dirt`) | Yes |
| `--to PREFIX` | New prefix to migrate to (e.g., `chimaro`) | Yes |
| `--project PATH` | Path to project directory | Yes |
| `--dry-run` | Preview changes without modifying | No |
| `--help` | Show help message | No |
| `--version` | Show version information | No |

### Safety Features

1. **Automatic Backup**
   - Creates timestamped backup directory
   - Copies all databases before migration
   - Generates SHA256 checksums for verification
   - Location: `<project>/.beads/backups/migration_<from>_to_<to>_<timestamp>/`

2. **Validation**
   - **Pre-migration checks:**
     - Validates prefix format (lowercase alphanumeric + hyphens)
     - Checks project structure exists
     - Verifies database accessibility
     - Detects ID collisions before migration
     - Counts tasks and dependencies for validation
   - **Post-migration validation:**
     - No tasks remain with old prefix
     - Expected count migrated to new prefix
     - Total task count preserved (no data loss)
     - Total dependency count preserved
     - Agent Mail thread IDs updated correctly

3. **Atomic Updates**
   - SQLite transactions ensure all-or-nothing updates
   - Rollback on any error
   - No partial migrations

4. **Error Handling**
   - Clear error messages
   - Exit codes for scripting
   - Rollback instructions on failure

### Example Output

```
╔══════════════════════════════════════════════════════════════════════════╗
║            Beads Project Prefix Migration Tool v1.0.0                  ║
╚══════════════════════════════════════════════════════════════════════════╝

ℹ  Configuration:
ℹ    From Prefix: dirt
ℹ    To Prefix: chimaro
ℹ    Project: /home/user/code/chimaro
ℹ    Beads DB: /home/user/code/chimaro/.beads/beads.db
ℹ    Agent Mail DB: /home/user/.agent-mail.db

ℹ  Validating inputs...
✓  Input validation passed

ℹ  Analyzing Beads database...
ℹ    Tasks with 'dirt-' prefix: 389
ℹ    Dependency references: 15
✓  Beads analysis complete (no collisions)

ℹ  Creating backup...
✓  Beads database backed up
ℹ    Location: /home/user/code/chimaro/.beads/backups/migration_dirt_to_chimaro_20251124_111843/beads.db.backup
ℹ    Checksum: 7a8b9c...

ℹ  Starting migration...
ℹ  Migrating Beads database...
✓  Beads database migration complete

ℹ  Validating migration...
✓  Beads database validation passed
✓  Migration validation complete - all checks passed

╔══════════════════════════════════════════════════════════════════════════╗
║                    ✓ MIGRATION COMPLETED SUCCESSFULLY                    ║
╚══════════════════════════════════════════════════════════════════════════╝

✓  All task IDs migrated from 'dirt-' to 'chimaro-'
✓  Backup location: /home/user/code/chimaro/.beads/backups/migration_dirt_to_chimaro_20251124_111843

ℹ  Next steps:
ℹ    1. Update Beads config: Set issue-prefix: "chimaro" in /home/user/code/chimaro/.beads/config.yaml
ℹ    2. Test with: bd list --json | jq -r '.[].id' | head -5
ℹ    3. Verify new tasks use new prefix: bd create "Test task"

ℹ  Rollback (if needed):
ℹ    cp /home/user/code/chimaro/.beads/backups/migration_dirt_to_chimaro_20251124_111843/beads.db.backup /home/user/code/chimaro/.beads/beads.db
```

### Workflow

#### 1. **Dry-Run First** (always recommended)

```bash
./tools/beads-migrate-prefix.sh \
  --from dirt \
  --to chimaro \
  --project ~/code/chimaro \
  --dry-run
```

Review the output:
- How many tasks will be migrated?
- Any collision warnings?
- Are the numbers reasonable?

#### 2. **Execute Migration**

```bash
./tools/beads-migrate-prefix.sh \
  --from dirt \
  --to chimaro \
  --project ~/code/chimaro
```

#### 3. **Update Config**

Edit `<project>/.beads/config.yaml`:

```yaml
# Uncomment and set new prefix
issue-prefix: "chimaro"
```

#### 4. **Verify**

```bash
# Check existing tasks have new IDs
bd list --json | jq -r '.[].id' | head -5

# Test new tasks use new prefix
bd create "Test task after migration"
```

### Rollback

**Option 1: Using rollback-beads.sh (Recommended)**

```bash
# Restore with verification and confirmation
./tools/rollback-beads.sh \
  --backup ~/code/chimaro/.beads/backups/migration_dirt_to_chimaro_20251124_111843 \
  --verify

# Restore without confirmation (automated)
./tools/rollback-beads.sh \
  --backup ~/code/chimaro/.beads/backups/migration_dirt_to_chimaro_20251124_111843 \
  --force
```

**Option 2: Manual rollback**

```bash
# Beads database
cp <backup-dir>/beads.db.backup <project>/.beads/beads.db

# Agent Mail database (if migrated)
cp <backup-dir>/agent-mail.db.backup ~/.agent-mail.db
```

Backup location is printed after migration completes.

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Invalid arguments or validation failed |
| 2 | Database error (migration or validation failed) |
| 3 | Backup/restore failed |

### Requirements

- `bash` (4.0+)
- `sqlite3` command-line tool
- `sha256sum` (for checksums)
- Read/write access to Beads database
- Read/write access to Agent Mail database (if present)

### Limitations

- Does **not** modify git commit messages (intentional - history stays unchanged)
- Does **not** update external documentation or files
- Agent Mail database is optional (skips if not found)
- Requires exclusive access to databases during migration

### Troubleshooting

**"Beads directory not found"**
- Verify project path is correct
- Ensure project was initialized with Beads (`bd init`)

**"Collision detected"**
- Target prefix already has tasks with same IDs
- Choose different target prefix or rename existing tasks first

**"Database is not readable/writable"**
- Check file permissions
- Ensure no other process is locking the database
- Try closing Beads daemon: `bd daemon stop`

**Migration failed mid-way**
- Check error message for details
- Restore from backup (see Rollback section)
- Report issue with backup location and error details

---

## Complete Workflow: Backup, Migrate, and Rollback

### Recommended Safe Migration Workflow

**Step 1: Pre-Migration Backup (Optional but Recommended)**

```bash
# Create standalone backup before migration
./tools/backup-beads.sh \
  --project ~/code/chimaro \
  --label "pre-migration" \
  --verify

# Note the backup location for quick rollback if needed
```

**Step 2: Dry-Run Migration (Always Recommended)**

```bash
# Preview what will change
./tools/beads-migrate-prefix.sh \
  --from dirt \
  --to chimaro \
  --project ~/code/chimaro \
  --dry-run

# Review output:
# - Task counts match expectations?
# - No collision warnings?
# - Numbers look reasonable?
```

**Step 3: Execute Migration**

```bash
# Run actual migration (creates automatic backup)
./tools/beads-migrate-prefix.sh \
  --from dirt \
  --to chimaro \
  --project ~/code/chimaro

# Migration creates backup automatically:
# ~/code/chimaro/.beads/backups/migration_dirt_to_chimaro_<timestamp>/
```

**Step 4: Verify Migration Success**

```bash
# Check tasks have new IDs
bd list | head -5

# Verify counts match
bd list --json | jq 'length'

# Test new task creation
bd create "Test task after migration"
```

**Step 5: Update Config**

```bash
# Edit .beads/config.yaml
echo 'issue-prefix: "chimaro"' >> ~/code/chimaro/.beads/config.yaml
```

**Step 6: If Something Goes Wrong - Rollback**

```bash
# Use rollback script (safest - creates safety backup)
./tools/rollback-beads.sh \
  --backup ~/code/chimaro/.beads/backups/migration_dirt_to_chimaro_<timestamp> \
  --verify

# Or use pre-migration backup
./tools/rollback-beads.sh \
  --backup ~/code/chimaro/.beads/backups/backup_<timestamp>_pre-migration \
  --verify
```

### Quick Backup & Restore (Non-Migration Use Cases)

**Regular Backups:**

```bash
# Daily backup
./tools/backup-beads.sh --project ~/code/chimaro --label "daily-$(date +%Y%m%d)"

# Before major changes
./tools/backup-beads.sh --project ~/code/chimaro --label "before-refactor" --verify

# Automated backups (cron)
0 2 * * * /home/user/code/jat/tools/backup-beads.sh --project /home/user/code/chimaro --label "auto-daily"
```

**Restore from Backup:**

```bash
# List available backups
ls -la ~/code/chimaro/.beads/backups/

# Restore specific backup
./tools/rollback-beads.sh \
  --backup ~/code/chimaro/.beads/backups/backup_20251124_020000_daily-20251124 \
  --verify

# Emergency restore (skip confirmation)
./tools/rollback-beads.sh \
  --backup ~/code/chimaro/.beads/backups/backup_<timestamp> \
  --force
```

### Development

The tools are designed to be:
- **Reusable**: Works with any Beads project and prefix pair
- **Safe**: Multiple validation layers and atomic transactions
- **Clear**: Verbose logging and color-coded output
- **Tested**: Dry-run mode and verification for safe testing
- **Independent**: Each tool can be used standalone or together

### Related Tasks

- `jat-8f3x`: Build Beads project prefix migration tool
- `jat-625k`: Design migration algorithm and data structures
- `jat-v0i6`: Create backup and rollback mechanism
- `jat-o8oy`: Implement SQLite schema migration logic
- `jat-f9pa`: Test migration on isolated copy
- `jat-y84z`: Execute production migration

### License

Part of Jomarchy Agent Tools (JAT) project.
