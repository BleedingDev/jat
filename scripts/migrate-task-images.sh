#!/bin/bash
# Migrate task images from /tmp to persistent storage
# Source: /tmp/claude-dashboard-files/
# Destination: ~/.local/share/jat/task-images/

set -e

SRC_DIR="/tmp/claude-dashboard-files"
DEST_DIR="$HOME/.local/share/jat/task-images"
TASK_IMAGES_JSON="$HOME/code/jat/.beads/task-images.json"

echo "=== Task Image Migration ==="
echo "Source: $SRC_DIR"
echo "Destination: $DEST_DIR"
echo ""

# Create destination directory if it doesn't exist
mkdir -p "$DEST_DIR"

# Check if source directory exists
if [ ! -d "$SRC_DIR" ]; then
    echo "No source directory found at $SRC_DIR"
    echo "Nothing to migrate."
    exit 0
fi

# Count files to migrate
FILE_COUNT=$(find "$SRC_DIR" -type f 2>/dev/null | wc -l)
if [ "$FILE_COUNT" -eq 0 ]; then
    echo "No files found in $SRC_DIR"
    echo "Nothing to migrate."
    exit 0
fi

echo "Found $FILE_COUNT files to migrate"
echo ""

# Copy files (preserving timestamps)
MIGRATED=0
for file in "$SRC_DIR"/*; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        dest_file="$DEST_DIR/$filename"

        if [ ! -f "$dest_file" ]; then
            cp -p "$file" "$dest_file"
            echo "  Migrated: $filename"
            MIGRATED=$((MIGRATED + 1))
        else
            echo "  Skipped (exists): $filename"
        fi
    fi
done

echo ""
echo "Migration complete: $MIGRATED files migrated"

# Update task-images.json if it exists
if [ -f "$TASK_IMAGES_JSON" ]; then
    echo ""
    echo "Updating task-images.json paths..."

    # Create backup
    cp "$TASK_IMAGES_JSON" "$TASK_IMAGES_JSON.bak"

    # Replace /tmp/claude-dashboard-files with new path
    sed -i "s|/tmp/claude-dashboard-files|$DEST_DIR|g" "$TASK_IMAGES_JSON"

    echo "  Updated paths in task-images.json"
    echo "  Backup saved to task-images.json.bak"
fi

echo ""
echo "=== Migration Complete ==="
