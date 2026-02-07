#!/usr/bin/env bash
#
# Example 4: Conflict Resolution
#
# Pattern: Handling file reservation conflicts gracefully
#
# Scenario:
#   - Bob tries to reserve files already held by Alice
#   - Conflict detected automatically
#   - Bob coordinates with Alice to work on different part
#   - Both agents work productively
#
# Key concepts:
#   - Automatic conflict detection
#   - Coordination via messages
#   - Shared locks (when appropriate)
#   - Working on different parts simultaneously
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIL_DIR="$(cd "$SCRIPT_DIR/../../tools/mail" && pwd)"
cd "$MAIL_DIR"

# Use a test database
export AGENT_MAIL_DB="/tmp/example-04.db"
rm -f "$AGENT_MAIL_DB"

echo "════════════════════════════════════════════════════════════"
echo "Example 4: Conflict Resolution"
echo "Database: $AGENT_MAIL_DB"
echo "════════════════════════════════════════════════════════════"
echo ""

# Step 1: Register agents
echo "Step 1: Register two agents"
./am-register --name Alice --program claude-code --model sonnet-4.5 --task "Auth refactoring"
./am-register --name Bob --program cursor --model gpt-4 --task "Auth testing"
echo ""

# Step 2: Alice reserves auth files
echo "Step 2: Alice reserves auth files exclusively"
./am-reserve "src/auth/**" --agent Alice --ttl 7200 --exclusive --reason "task-789: Refactoring auth flow"
echo ""

# Step 3: Bob tries to reserve same files (CONFLICT!)
echo "Step 3: Bob tries to reserve same files → CONFLICT DETECTED"
./am-reserve "src/auth/**" --agent Bob --ttl 3600 --exclusive --reason "task-790: Adding auth tests" 2>&1 || echo "(Expected conflict)"
echo ""

# Step 4: Bob checks who has the lock
echo "Step 4: Bob checks active reservations"
./am-reservations
echo ""

# Step 5: Bob messages Alice to coordinate
echo "Step 5: Bob sends coordination message to Alice"
./am-send "[coordination] Auth files conflict" \
  "$(cat <<'EOF'
Hi Alice,

I need to add tests for the auth flow but you have src/auth/** reserved.

**My task:** Add integration tests for auth
**Your task:** Refactoring auth flow

**Suggested approach:**
1. I can write tests against the OLD auth flow first (doesn't touch src/auth/**)
2. When you're done refactoring, I'll update tests for the new flow
3. OR: I can work on a different task and come back later

What works best for your timeline?
EOF
)" \
  --from Bob --to Alice --thread coordination --importance high --ack
echo ""

# Step 6: Alice responds with timeline
echo "Step 6: Alice responds with her timeline"
./am-inbox Alice
./am-ack 1 --agent Alice
./am-reply 1 "$(cat <<'EOF'
Good coordination, Bob!

My auth refactor will take about 1 more hour. Here's a better approach:

**Immediate option:**
- You can read auth files (no reservation needed for reading)
- Write tests in tests/auth/** (different pattern, no conflict!)
- I'll notify you when refactor is done

**After my refactor:**
- I'll release src/auth/**
- You update tests to match new auth flow
- We both win!

Does that work?
EOF
)" --agent Alice
echo ""

# Step 7: Bob agrees and works on tests
echo "Step 7: Bob works on tests (different file pattern - no conflict!)"
./am-reserve "tests/auth/**" --agent Bob --ttl 3600 --exclusive --reason "task-790: Writing auth tests"
./am-send "[task-790] Writing tests against current auth" \
  "Writing integration tests in tests/auth/**. Will update after your refactor!" \
  --from Bob --to Alice --thread task-790
echo ""

# Step 8: Alice finishes and notifies Bob
echo "Step 8: Alice completes refactor and releases files"
./am-send "[task-789] ✅ Auth refactor complete" \
  "Refactor done! Tests should still pass. Let me know if you need help updating them." \
  --from Alice --to Bob --thread task-789 --importance high
./am-release "src/auth/**" --agent Alice
echo ""

# Step 9: Bob updates tests
echo "Step 9: Bob now reserves src/auth/** (no conflict!) and updates tests"
./am-reserve "src/auth/**" --agent Bob --ttl 1800 --exclusive --reason "task-790: Updating tests for new auth"
./am-send "[task-790] ✅ Tests updated and passing" \
  "All auth tests updated for new flow. Everything passing!" \
  --from Bob --to Alice --thread task-790 --importance high
./am-release "src/auth/**" --agent Bob
./am-release "tests/auth/**" --agent Bob
echo ""

# Step 10: Review the coordination
echo "Step 10: Review how conflict was resolved"
./am-search "coordination"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✓ Example complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Key takeaways:"
echo "  • Conflicts are detected AUTOMATICALLY (not manual coordination)"
echo "  • When blocked, message the agent holding the lock"
echo "  • Suggest alternatives (different file patterns, timing, tasks)"
echo "  • Reading files doesn't need reservations (only writing does)"
echo "  • Use different file patterns to work simultaneously"
echo "  • Communicate completion so others can proceed"
echo ""
echo "Conflict resolution strategies:"
echo "  1. Work on different file patterns (tests/ vs src/)"
echo "  2. Wait for lock expiry (check TTL)"
echo "  3. Coordinate timing (\"I'll be done in 1 hour\")"
echo "  4. Switch to different task temporarily"
echo "  5. Use shared locks if both are only reading"
echo ""
echo "Anti-pattern to avoid:"
echo "  ✗ Force-proceeding without coordination (causes merge conflicts)"
echo "  ✓ Message and coordinate (like this example)"
echo ""
