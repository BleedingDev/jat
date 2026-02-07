#!/usr/bin/env bash
#
# Example 3: Task Handoff Pattern
#
# Pattern: One agent hands off work to another agent
#
# Scenario:
#   - Alice starts refactoring but gets blocked
#   - Alice hands off to Bob who has the needed expertise
#   - Bob completes the work and notifies Alice
#
# Key concepts:
#   - File reservation release
#   - Handoff messages
#   - Context sharing
#   - Acknowledgment of handoff
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIL_DIR="$(cd "$SCRIPT_DIR/../../tools/mail" && pwd)"
cd "$MAIL_DIR"

# Use a test database
export AGENT_MAIL_DB="/tmp/example-03.db"
rm -f "$AGENT_MAIL_DB"

echo "════════════════════════════════════════════════════════════"
echo "Example 3: Task Handoff Pattern"
echo "Database: $AGENT_MAIL_DB"
echo "════════════════════════════════════════════════════════════"
echo ""

# Step 1: Register agents
echo "Step 1: Register agents with different specialties"
./am-register --name Alice --program claude-code --model sonnet-4.5 --task "Frontend refactoring"
./am-register --name Bob --program cursor --model gpt-4 --task "Database optimization expert"
echo ""

# Step 2: Alice starts work
echo "Step 2: Alice starts refactoring"
./am-reserve "src/lib/database/**" --agent Alice --ttl 3600 --exclusive --reason "task-456: Database refactor"
./am-send "[task-456] Starting database refactor" \
  "Refactoring database layer for better performance." \
  --from Alice --to Bob --thread task-456
echo ""

# Step 3: Alice encounters a blocker
echo "Step 3: Alice hits a blocker and decides to hand off"
./am-send "[task-456] 🤝 HANDOFF REQUEST" \
  "$(cat <<'EOF'
I've made progress on the refactor but hit a complex SQL optimization issue.

**What's done:**
- Restructured connection pooling
- Updated transaction handling
- Added basic query caching

**What's blocking:**
- Complex JOIN optimization (lines 234-289 in db/queries.js)
- Need expertise in Postgres query planning

**Handoff files:**
- src/lib/database/** (currently reserved by me)

Bob, you're the DB expert - can you take over? I'll release my reservation.
EOF
)" \
  --from Alice --to Bob --thread task-456 --importance high --ack
echo ""

# Step 4: Alice releases reservation
echo "Step 4: Alice releases files for Bob to take over"
./am-release "src/lib/database/**" --agent Alice
echo ""

# Step 5: Bob acknowledges and reserves
echo "Step 5: Bob acknowledges handoff and reserves files"
./am-inbox Bob --thread task-456
./am-ack 2 --agent Bob
./am-reserve "src/lib/database/**" --agent Bob --ttl 3600 --exclusive --reason "task-456: Taking over from Alice"
./am-send "[task-456] ✅ Handoff accepted" \
  "Taking over the DB optimization. Will review your work and finish the JOIN optimization." \
  --from Bob --to Alice --thread task-456
echo ""

# Step 6: Bob completes the work
echo "Step 6: Bob completes optimization"
./am-send "[task-456] ✅ COMPLETE - Optimization done" \
  "$(cat <<'EOF'
Task complete! Here's what I did:

**Your work (kept):**
✓ Connection pooling - excellent structure
✓ Transaction handling - clean implementation
✓ Query caching - good foundation

**My additions:**
✓ Optimized complex JOINs (lines 234-289)
✓ Added query explain analyzer
✓ Improved index usage
✓ Performance: 3x faster on complex queries

Great handoff! Your groundwork made this easy.
EOF
)" \
  --from Bob --to Alice --thread task-456 --importance high
./am-release "src/lib/database/**" --agent Bob
echo ""

# Step 7: Review handoff conversation
echo "Step 7: Review complete handoff thread"
./am-search "\"task-456\"" --thread task-456
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✓ Example complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Key takeaways:"
echo "  • Use 🤝 HANDOFF REQUEST in subject for visibility"
echo "  • Document what's done and what's blocking"
echo "  • Release reservations BEFORE handoff (enables immediate pickup)"
echo "  • Acknowledge handoff acceptance explicitly"
echo "  • Share context about existing work (prevents duplication)"
echo "  • Use --ack flag for handoff messages (confirms receipt)"
echo ""
echo "Common handoff scenarios:"
echo "  • Blocked by expertise gap (like this example)"
echo "  • Context switch (urgent work elsewhere)"
echo "  • End of work session (timezone handoff)"
echo "  • Specialization (backend → frontend)"
echo ""
