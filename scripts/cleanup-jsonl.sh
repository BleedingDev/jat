#!/bin/bash
#
# Cleanup old Claude Code JSONL session files
#
# These files contain full conversation history but token usage
# is already aggregated into ~/.claude/token-usage.db by the dashboard.
#
# Safe to delete files older than 7 days.
#
# Usage:
#   cleanup-jsonl.sh          # Dry run (show what would be deleted)
#   cleanup-jsonl.sh --delete # Actually delete files
#   cleanup-jsonl.sh --archive /path/to/archive  # Move to archive folder

set -e

PROJECTS_DIR="$HOME/.claude/projects"
DAYS_TO_KEEP=7
MODE="dry-run"
ARCHIVE_DIR=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --delete)
            MODE="delete"
            shift
            ;;
        --archive)
            MODE="archive"
            ARCHIVE_DIR="$2"
            shift 2
            ;;
        --days)
            DAYS_TO_KEEP="$2"
            shift 2
            ;;
        *)
            echo "Usage: $0 [--delete | --archive <path>] [--days N]"
            exit 1
            ;;
    esac
done

echo "=== Claude JSONL Cleanup ==="
echo "Projects dir: $PROJECTS_DIR"
echo "Keep files newer than: $DAYS_TO_KEEP days"
echo "Mode: $MODE"
echo ""

# Count and size before
TOTAL_FILES=$(find "$PROJECTS_DIR" -name "*.jsonl" -type f 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$PROJECTS_DIR" 2>/dev/null | cut -f1)
echo "Current state: $TOTAL_FILES files, $TOTAL_SIZE total"
echo ""

# Find old files
OLD_FILES=$(find "$PROJECTS_DIR" -name "*.jsonl" -type f -mtime +$DAYS_TO_KEEP 2>/dev/null)
OLD_COUNT=$(echo "$OLD_FILES" | grep -c . || echo 0)
OLD_SIZE=$(echo "$OLD_FILES" | xargs du -ch 2>/dev/null | tail -1 | cut -f1)

echo "Files older than $DAYS_TO_KEEP days: $OLD_COUNT files, $OLD_SIZE"
echo ""

if [[ "$OLD_COUNT" -eq 0 ]]; then
    echo "No old files to clean up."
    exit 0
fi

# Show sample of files to be affected
echo "Sample files to process:"
echo "$OLD_FILES" | head -5 | while read f; do
    echo "  $(ls -lh "$f" 2>/dev/null | awk '{print $5, $6, $7, $8, $9}')"
done
if [[ "$OLD_COUNT" -gt 5 ]]; then
    echo "  ... and $((OLD_COUNT - 5)) more"
fi
echo ""

case $MODE in
    dry-run)
        echo "Dry run complete. Use --delete or --archive to proceed."
        echo ""
        echo "Commands:"
        echo "  $0 --delete              # Delete old files"
        echo "  $0 --archive ~/archive   # Move to archive folder"
        echo "  $0 --days 14             # Change retention period"
        ;;
    delete)
        echo "Deleting $OLD_COUNT files..."
        echo "$OLD_FILES" | xargs rm -f
        NEW_SIZE=$(du -sh "$PROJECTS_DIR" 2>/dev/null | cut -f1)
        echo "Done! New size: $NEW_SIZE (was $TOTAL_SIZE)"
        ;;
    archive)
        if [[ -z "$ARCHIVE_DIR" ]]; then
            echo "Error: --archive requires a path"
            exit 1
        fi
        mkdir -p "$ARCHIVE_DIR"
        echo "Archiving $OLD_COUNT files to $ARCHIVE_DIR..."
        echo "$OLD_FILES" | while read f; do
            # Preserve directory structure
            rel_path="${f#$PROJECTS_DIR/}"
            dest_dir="$ARCHIVE_DIR/$(dirname "$rel_path")"
            mkdir -p "$dest_dir"
            mv "$f" "$dest_dir/"
        done
        NEW_SIZE=$(du -sh "$PROJECTS_DIR" 2>/dev/null | cut -f1)
        ARCHIVE_SIZE=$(du -sh "$ARCHIVE_DIR" 2>/dev/null | cut -f1)
        echo "Done! Projects: $NEW_SIZE, Archive: $ARCHIVE_SIZE"
        ;;
esac
