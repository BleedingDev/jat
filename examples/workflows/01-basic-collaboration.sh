#!/usr/bin/env bash
#
# Example 1: Basic Two-Agent Collaboration
#
# Pattern: Two agents working on related tasks with coordination via Agent Mail
#
# Scenario:
#   - Alice is building a new API endpoint
#   - Bob is building the frontend component that uses it
#   - They coordinate via messages and file reservations
#
# Key concepts:
#   - Agent registration
#   - File reservations (exclusive locks)
#   - Message threading
#   - Status updates
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIL_DIR="$(cd "$SCRIPT_DIR/../../tools/mail" && pwd)"
cd "$MAIL_DIR"

# Use a test database
export AGENT_MAIL_DB="/tmp/example-01.db"
rm -f "$AGENT_MAIL_DB"

echo "════════════════════════════════════════════════════════════"
echo "Example 1: Basic Two-Agent Collaboration"
echo "Database: $AGENT_MAIL_DB"
echo "════════════════════════════════════════════════════════════"
echo ""

# Step 1: Register agents
echo "Step 1: Register two agents"
./am-register --name Alice --program claude-code --model sonnet-4.5 --task "Backend API development"
./am-register --name Bob --program cursor --model gpt-4 --task "Frontend component development"
echo ""

# Step 2: Alice reserves backend files and starts work
echo "Step 2: Alice reserves backend files and announces start"
./am-reserve "api/**" --agent Alice --ttl 3600 --exclusive --reason "task-123: Building user API"
./am-send "[task-123] Starting: User API endpoint" \
  "Building POST /api/users endpoint. Will be ready for frontend integration in 1 hour." \
  --from Alice --to Bob --thread task-123 --importance high
echo ""

# Step 3: Bob acknowledges and reserves frontend files
echo "Step 3: Bob reads message and reserves frontend files"
./am-inbox Bob
./am-ack 1 --agent Bob
./am-reserve "src/components/users/**" --agent Bob --ttl 3600 --exclusive --reason "task-123: User component"
echo ""

# Step 4: Alice completes API and notifies Bob
echo "Step 4: Alice completes API work and notifies Bob"
./am-send "[task-123] API endpoint ready" \
  "POST /api/users is complete and tested. Endpoint accepts: {name, email}. Returns: {id, created_at}." \
  --from Alice --to Bob --thread task-123 --importance high --ack
./am-release "api/**" --agent Alice
echo ""

# Step 5: Bob acknowledges and starts integration
echo "Step 5: Bob starts frontend integration"
./am-inbox Bob --thread task-123
./am-ack 2 --agent Bob
./am-send "[task-123] Starting frontend integration" \
  "Building UserForm.svelte component. Testing with API endpoint." \
  --from Bob --to Alice --thread task-123
echo ""

# Step 6: Bob completes and releases files
echo "Step 6: Bob completes integration"
./am-send "[task-123] Frontend complete" \
  "UserForm component working with API. Task complete!" \
  --from Bob --to Alice --thread task-123 --importance high
./am-release "src/components/users/**" --agent Bob
echo ""

# Step 7: Review thread
echo "Step 7: Review complete conversation thread"
echo ""
./am-search "\"task-123\"" --thread task-123
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✓ Example complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Key takeaways:"
echo "  • Agents reserve files before starting work (prevents conflicts)"
echo "  • Use thread IDs (like task-123) to organize related messages"
echo "  • Set importance (high) for blocking work"
echo "  • Use --ack flag for critical messages that need confirmation"
echo "  • Release reservations when done"
echo "  • Search messages by thread to see full conversation"
echo ""
