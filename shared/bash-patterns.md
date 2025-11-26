## Common Bash Tool Patterns

The Bash tool executes commands in a shell. Proper syntax is critical to avoid "Exit code 2" errors.

**Common Error: Invalid if-statement chaining**
```bash
# ❌ WRONG - syntax error
SESSION_ID="abc123"
if [[ -f "$file" ]]; then echo "exists"; fi

# ❌ WRONG - can't chain if with &&
SESSION_ID="abc123" && if [[ -f "$file" ]]; then echo "exists"; fi
```

**Correct Patterns:**

**1. Semicolon separation (inline everything)**
```bash
# ✅ CORRECT
SESSION_ID="abc123"; if [[ -f ".claude/agent-${SESSION_ID}.txt" ]]; then cat ".claude/agent-${SESSION_ID}.txt"; else echo "not found"; fi
```

**2. Use test command with && / ||**
```bash
# ✅ CORRECT - most concise
test -f "$file" && echo "exists" || echo "not found"

# ✅ CORRECT - with variable
SESSION_ID="abc123" && test -f ".claude/agent-${SESSION_ID}.txt" && cat ".claude/agent-${SESSION_ID}.txt" || echo "not found"
```

**3. Use [[ ]] with && / || (no if keyword)**
```bash
# ✅ CORRECT
[[ -f "$file" ]] && echo "exists" || echo "not found"

# ✅ CORRECT - multi-step
SESSION_ID="abc123" && [[ -f ".claude/agent-${SESSION_ID}.txt" ]] && cat ".claude/agent-${SESSION_ID}.txt" || echo "not found"
```

**4. Subshell for complex logic**
```bash
# ✅ CORRECT - use subshell for multi-line
SESSION_ID="abc123" && (
  if [[ -f ".claude/agent-${SESSION_ID}.txt" ]]; then
    cat ".claude/agent-${SESSION_ID}.txt"
  else
    echo "not found"
  fi
)
```

**5. Reading file content into variables for filenames**
```bash
# ❌ WRONG - command substitution with && causes escaping issues in Bash tool
SESSION_ID=$(cat .claude/session-id.txt | tr -d '\n') && echo "value" > ".claude/agent-${SESSION_ID}.txt"

# ❌ WRONG - even with subshell, may fail due to Bash tool escaping
(
  SESSION_ID=$(cat .claude/session-id.txt | tr -d '\n')
  echo "value" > ".claude/agent-${SESSION_ID}.txt"
)

# ✅ CORRECT - Use Read + Write tools when you need file content in a filename
# 1. Read the file using Read tool
# 2. Extract the value in your code (not bash)
# 3. Use Write tool with the computed filename
# Example: Read(.claude/session-id.txt) → get "abc123" → Write(.claude/agent-abc123.txt)

# ✅ ALTERNATIVE - If you must use Bash, write to fixed temp file first
cat .claude/session-id.txt | tr -d '\n' > /tmp/session-id.tmp && \
  echo "value" > ".claude/agent-$(cat /tmp/session-id.tmp).txt"
```

**Key Rules:**
- `if` is a keyword, not a command - can't use with `&&` directly
- Use semicolons `;` to separate statements on one line
- Use `test` or `[[ ]]` for conditionals with `&&` / `||`
- **When file content determines a path: prefer Read/Write tools over command substitution**
- When in doubt, inline everything with semicolons
