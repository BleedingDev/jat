---
argument-hint: [quick | full]
---

Comprehensive verification before completing a task - code quality, tests, security, documentation, and browser testing.

# Verify Task Quality

**Purpose:** Ensure work is complete and correct before marking task done.

**Use when:**
- Before `/agent/complete` to catch issues
- After major changes to validate
- Before handing off work to another agent
- Anytime you want quality assurance

**Usage:**
- `/agent/verify` or `/agent/verify full` - Complete verification (static + browser)
- `/agent/verify quick` - Static checks only (no browser testing)

---

## Verification Levels

### Quick Mode (Static Checks Only)

Fast verification without browser:
1. Type checking
2. Linting
3. Security scan
4. Documentation check
5. Git status check

**Use when:**
- Backend/API changes (no UI)
- Quick sanity check
- CI/CD pipeline would catch issues anyway

### Full Mode (Default - Static + Browser)

Comprehensive verification including browser testing:
1. All static checks (quick mode)
2. **Browser testing with Chrome DevTools MCP**
3. Visual verification
4. User interaction testing
5. Console error checking
6. Network request validation

**Use when:**
- UI/UX changes (anything user-facing)
- Component modifications
- Route/page changes
- Before completing any frontend work

---

## Execution Steps

### PART 1: Static Verification (Always)

#### 1. Type Checking

```bash
npm run check
```

**What to verify:**
- No TypeScript errors
- All types properly defined
- No `any` types introduced (unless justified)
- Proper type guards used

**If errors found:**
- Count total errors
- Categorize by type
- Determine if blocking (new errors) vs existing
- **Decision:**
  - New errors introduced? → MUST FIX before completing
  - Existing errors? → Note in verification report
  - Too many new errors? → Call code-refactorer agent

#### 2. Linting

```bash
npm run lint
```

**What to verify:**
- No ESLint errors
- Svelte 5 syntax compliance (check CLAUDE.md Pre-Flight Checklist)
- No deprecated patterns (on:click vs onclick, etc.)
- Code style consistency

**If errors found:**
- Auto-fix if possible: `npm run lint -- --fix`
- Manual fix for non-auto-fixable
- If many errors, call code-refactorer

#### 3. Security Scan

**Check for common security issues:**

```bash
# Grep for potential secrets
grep -r "API_KEY\|SECRET\|PASSWORD\|TOKEN" --include="*.ts" --include="*.js" --include="*.svelte" src/

# Check for hardcoded credentials
grep -r "sk_\|pk_\|password\s*=\|apiKey\s*=" --include="*.ts" --include="*.js" --include="*.svelte" src/

# Check for dangerous patterns
grep -r "eval(\|innerHTML\|dangerouslySetInnerHTML" --include="*.ts" --include="*.js" --include="*.svelte" src/
```

**What to verify:**
- No secrets in source code
- No API keys committed
- No SQL injection vulnerabilities
- No XSS vulnerabilities
- Proper input validation
- Security patterns from CLAUDE.md followed

**If issues found:**
- BLOCK completion until fixed
- Security is non-negotiable

#### 4. Documentation Check

**Verify documentation is current:**

```bash
# Check if CLAUDE.md needs updates
git diff CLAUDE.md

# Check if docs/ needs updates
git diff docs/
```

**What to verify:**
- New patterns documented in CLAUDE.md
- Critical patterns in Pre-Flight Checklist
- Common Pitfalls updated if new pitfall found
- Security Best Practices updated if security pattern added
- Feature docs in /docs/ updated if architecture changed

**If docs missing:**
- Update CLAUDE.md for patterns/security/pitfalls
- Update /docs/ for architecture/features
- Include doc updates in commit

#### 5. Git Status Check

```bash
git status
```

**What to verify:**
- No unexpected files modified
- No debug files committed (.log, .tmp, etc.)
- No large files (check file sizes)
- Changes align with task scope

**If issues found:**
- Remove debug files
- Revert unintended changes
- Clean up git state

---

### PART 2: Browser Verification (Full Mode Only)

**CRITICAL: Only run if changes affect browser/UI**

Skip if:
- Backend API changes only
- Database migrations
- Server-side utilities
- Documentation only changes

Run if:
- Any Svelte component changes
- Route/page changes
- CSS/styling changes
- User interactions
- Form handling
- State management affecting UI

#### Step 1: Start Development Server

```bash
# Check if dev server already running
lsof -i :5173 || lsof -i :3000

# If not running, start it in background
npm run dev &
VITE_PID=$!

# Wait for server to be ready
sleep 5
```

**Track PID to kill later:**
```bash
echo $VITE_PID > /tmp/verify-dev-server.pid
```

#### Step 2: Open Browser with Chrome

```bash
# Start Chrome with debugging enabled
browser-start.js --profile

# Navigate to dev server
browser-nav.js "http://localhost:5173"
```

#### Step 3: Navigate to Feature Under Test

**Determine URL from task context:**
- Check file changes → infer route
- Check task description → extract feature
- Ask task-specific questions if unclear

```bash
# Navigate to specific feature
browser-nav.js "http://localhost:5173/account/settings"
```

#### Step 4: Take Initial Screenshot and Analyze

```bash
# Take screenshot of current page
screenshot_path=$(browser-screenshot.js)
echo "Screenshot saved: $screenshot_path"

# Extract page content and structure via JavaScript
browser-eval.js 'document.body.innerText' > /tmp/page-text.txt
browser-eval.js 'document.querySelectorAll("button, input, a").length'

# Or use interactive picker to explore elements
browser-pick.js "Click on the main content area to inspect"
```

**Analyze output:**
- Does expected content appear?
- Are new components visible?
- Is structure correct?

#### Step 5: Test User Interactions

**For each interaction the feature supports:**

**Example: Testing a form**
```bash
# 1. Use interactive picker to identify elements
browser-pick.js "Select the email input field"
# Returns: selector or path to element

# 2. Fill form fields using JavaScript
browser-eval.js 'document.querySelector("input[type=email]").value = "test@example.com"'
browser-eval.js 'document.querySelector("input[name=name]").value = "Test User"'

# 3. Click submit button
browser-eval.js 'document.querySelector("button[type=submit]").click()'

# 4. Wait for result (simple polling approach)
sleep 2
browser-eval.js 'document.body.innerText.includes("Profile updated successfully")'

# 5. Take screenshot of result
browser-screenshot.js
```

**Example: Testing navigation**
```bash
# Click navigation link using JavaScript
browser-eval.js 'document.querySelector("a.nav-link").click()'

# Wait for navigation
sleep 2

# Verify navigation occurred
browser-eval.js 'document.title'
browser-eval.js 'document.body.innerText.includes("Expected Page Title")'
```

**Example: Testing dynamic content**
```bash
# Trigger action that loads data
browser-eval.js 'document.querySelector("button.load-data").click()'

# Wait for loading to complete (longer timeout for data)
sleep 5

# Verify data appears
browser-eval.js 'document.body.innerText.includes("Data loaded")'
browser-screenshot.js
```

#### Step 6: Check Console for Errors

**CRITICAL: Check for JavaScript errors**

```bash
# Capture console errors via JavaScript
browser-eval.js '
  window.__errors = [];
  window.__originalConsoleError = console.error;
  console.error = (...args) => {
    window.__errors.push(args.join(" "));
    window.__originalConsoleError(...args);
  };
  "Console monitoring started"
'

# Perform your testing interactions here...
# (form fills, clicks, navigation)

# Retrieve captured errors
browser-eval.js 'JSON.stringify(window.__errors)' > /tmp/console-errors.json

# Check for errors
cat /tmp/console-errors.json
```

**What to look for:**
- Uncaught exceptions
- Network errors (404, 500, CORS)
- React/Svelte warnings
- Type errors at runtime
- Failed API calls

**If errors found:**
- Critical errors → BLOCK completion
- Warnings → Investigate, may be acceptable
- Third-party errors → Note but may not block

#### Step 7: Check Network Requests

**For features that make API calls:**

```bash
# Monkey-patch fetch to capture requests
browser-eval.js '
  window.__requests = [];
  window.__originalFetch = fetch;
  window.fetch = async (...args) => {
    const [url, options] = args;
    const startTime = Date.now();
    try {
      const response = await window.__originalFetch(...args);
      window.__requests.push({
        url,
        method: options?.method || "GET",
        status: response.status,
        duration: Date.now() - startTime
      });
      return response;
    } catch (error) {
      window.__requests.push({
        url,
        method: options?.method || "GET",
        error: error.message
      });
      throw error;
    }
  };
  "Network monitoring started"
'

# Perform your testing interactions...

# Retrieve captured requests
browser-eval.js 'JSON.stringify(window.__requests)' > /tmp/network-requests.json

# Analyze requests
cat /tmp/network-requests.json | jq '.'
```

**What to verify:**
- API calls succeed (200-299 status)
- Correct endpoints hit
- Proper error handling (4xx, 5xx)
- No unnecessary requests (N+1 queries)
- Proper authentication headers

#### Step 8: Visual Verification (Screenshot)

**Take screenshot for visual confirmation:**

```bash
# Take viewport screenshot
screenshot_path=$(browser-screenshot.js)
echo "Screenshot saved: $screenshot_path"
```

**What to verify:**
- Layout looks correct
- No visual glitches
- Responsive design works
- Colors/styling correct
- No overflow/clipping issues

**For responsive testing:**
```bash
# Test mobile viewport (375x667)
browser-eval.js 'window.resizeTo(375, 667)'
sleep 1
browser-screenshot.js
echo "Mobile screenshot saved"

# Test tablet viewport (768x1024)
browser-eval.js 'window.resizeTo(768, 1024)'
sleep 1
browser-screenshot.js
echo "Tablet screenshot saved"

# Test desktop (1920x1080)
browser-eval.js 'window.resizeTo(1920, 1080)'
sleep 1
browser-screenshot.js
echo "Desktop screenshot saved"
```

#### Step 9: Test Edge Cases

**Common edge cases to test:**

**Empty states:**
```bash
# Navigate to page with no data
browser-nav.js "http://localhost:5173/empty-page"

# Wait and verify empty state message appears
sleep 2
browser-eval.js 'document.body.innerText.includes("No items found")'
```

**Error states:**
```bash
# Trigger error condition (invalid input)
browser-eval.js 'document.querySelector("input[type=email]").value = "invalid-email"'
browser-eval.js 'document.querySelector("button[type=submit]").click()'

# Wait for error message
sleep 1

# Verify error message appears
browser-eval.js 'document.body.innerText.includes("Invalid email address")'
```

**Loading states:**
```bash
# Trigger action with delay
browser-eval.js 'document.querySelector("button.load-slow").click()'

# Check loading indicator appears (quick check before it disappears)
sleep 0.5
browser-eval.js 'document.querySelector(".loading-spinner") !== null'
```

#### Step 10: Cleanup Browser

```bash
# Browser will stay open (manual close or use pkill chrome if needed)
# Note: browser-*.js tools don't have explicit page close

# Kill dev server if we started it
if [ -f /tmp/verify-dev-server.pid ]; then
  kill $(cat /tmp/verify-dev-server.pid)
  rm /tmp/verify-dev-server.pid
fi
```

---

### PART 3: Decision Making

**Aggregate all verification results:**

```typescript
const verificationResults = {
  static: {
    typeCheck: { passed: true, errors: 0 },
    linting: { passed: false, errors: 3 },
    security: { passed: true, issues: [] },
    documentation: { passed: true, updated: ["CLAUDE.md"] },
    gitStatus: { passed: true, clean: true }
  },
  browser: {
    pageLoads: { passed: true, url: "..." },
    interactions: { passed: true, tested: 5 },
    consoleErrors: { passed: false, errors: [{ ... }] },
    networkRequests: { passed: true, requests: 8 },
    visualCheck: { passed: true, screenshots: 3 },
    edgeCases: { passed: true, tested: 3 }
  }
}
```

**Decision logic:**

**✅ PASS - Can complete task:**
- All static checks pass
- All browser tests pass (if applicable)
- No critical errors
- Documentation updated

**⚠️ MINOR ISSUES - Fix before completing:**
- Lint errors (auto-fixable)
- Non-critical console warnings
- Missing documentation
- **Action:** Fix issues, re-run verify

**❌ FAIL - Cannot complete:**
- Type errors introduced
- Security vulnerabilities
- Critical console errors
- Feature doesn't work as expected
- **Action:** Requires refactoring

---

### PART 4: Self-Correction Loop

**If verification fails with fixable issues:**

#### Option 1: Self-Fix (Simple Issues)

**For issues like:**
- Lint errors
- Missing documentation
- Simple type errors

```typescript
// Fix the issues directly
// Re-run verification
await verify()
```

#### Option 2: Call code-refactorer Agent (Complex Issues)

**For issues like:**
- Many type errors
- Architectural problems
- Complex bugs found in browser testing

```typescript
// Launch code-refactorer with context
await Task({
  subagent_type: "code-refactorer",
  description: "Fix verification issues",
  prompt: `
    Verification failed with the following issues:

    ${JSON.stringify(verificationResults, null, 2)}

    Please fix:
    1. Type errors in userStore.svelte.ts
    2. Console error: "Cannot read property 'id' of undefined"
    3. Network error: POST /api/users returns 500

    Files to focus on:
    - src/lib/stores/userStore.svelte.ts
    - src/lib/components/UserProfile.svelte
    - src/routes/api/users/+server.ts

    After fixing, re-run verification to confirm.
  `
})
```

**code-refactorer agent will:**
1. Analyze the issues
2. Fix the code
3. Run verification again
4. Report back when passing

#### Option 3: Ask for Help

**If issues are unclear or require decisions:**

```typescript
await AskUserQuestion({
  questions: [{
    question: "Verification found console error: 'User ID undefined'. This might be expected during logout. Should we suppress this warning or fix the root cause?",
    header: "Error handling",
    options: [
      { label: "Suppress warning", description: "Add error boundary for logout state" },
      { label: "Fix root cause", description: "Ensure user object always defined" }
    ],
    multiSelect: false
  }]
})
```

---

## Output Format

After completing verification, format output:

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    ✅ TASK VERIFICATION REPORT                           ║
║                                                                          ║
║                    Mode: [Quick | Full]                                  ║
╚══════════════════════════════════════════════════════════════════════════╝

┌─ STATIC VERIFICATION ──────────────────────────────────────────────────┐
│                                                                        │
│  ✅ Type Check: PASSED (0 errors)                                      │
│  ✅ Linting: PASSED (0 errors, 2 auto-fixed)                           │
│  ✅ Security: PASSED (no issues found)                                 │
│  ✅ Documentation: PASSED (CLAUDE.md updated)                          │
│  ✅ Git Status: PASSED (clean, expected changes only)                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ BROWSER VERIFICATION ─────────────────────────────────────────────────┐
│                                                                        │
│  🌐 Page: http://localhost:5173/account/settings                       │
│                                                                        │
│  ✅ Page Load: PASSED (1.2s load time)                                 │
│  ✅ User Interactions: PASSED (5 interactions tested)                  │
│     • Fill email field → Success                                       │
│     • Fill name field → Success                                        │
│     • Click save button → Success                                      │
│     • Form submission → Success                                        │
│     • Success message displayed → Success                              │
│                                                                        │
│  ✅ Console Check: PASSED (0 errors, 0 warnings)                       │
│                                                                        │
│  ✅ Network Requests: PASSED (8 requests, all successful)              │
│     • GET /api/user/profile → 200 OK (125ms)                           │
│     • PUT /api/user/profile → 200 OK (89ms)                            │
│     • [6 other requests...]                                            │
│                                                                        │
│  ✅ Visual Check: PASSED (3 viewports tested)                          │
│     • Mobile (375x667): Layout correct                                 │
│     • Tablet (768x1024): Layout correct                                │
│     • Desktop (1920x1080): Layout correct                              │
│                                                                        │
│  ✅ Edge Cases: PASSED (3 scenarios tested)                            │
│     • Empty email → Error message shown                                │
│     • Invalid email → Validation works                                 │
│     • Network error → Error handling works                             │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ VERIFICATION SUMMARY ─────────────────────────────────────────────────┐
│                                                                        │
│  ✅ OVERALL RESULT: PASSED                                             │
│                                                                        │
│  All checks passed. Task is ready for completion.                      │
│                                                                        │
│  Quality Score: 100/100                                                │
│  ├─ Static checks: 50/50                                               │
│  └─ Browser tests: 50/50                                               │
│                                                                        │
│  Ready for: /agent/complete                                            │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║                    ✅ VERIFICATION COMPLETE ✅                            ║
║                                                                          ║
║                    Status: READY TO COMPLETE                             ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

**If verification fails:**

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    ⚠️  VERIFICATION FAILED                               ║
║                                                                          ║
║                    Mode: Full                                            ║
╚══════════════════════════════════════════════════════════════════════════╝

┌─ ISSUES FOUND ─────────────────────────────────────────────────────────┐
│                                                                        │
│  ❌ Console Errors: 2 critical errors                                  │
│     1. TypeError: Cannot read property 'id' of undefined               │
│        at UserProfile.svelte:45                                        │
│        Impact: Profile page crashes on load                            │
│                                                                        │
│     2. Network Error: POST /api/users → 500 Internal Server Error      │
│        Impact: Cannot save user profile                                │
│                                                                        │
│  ⚠️  Linting: 5 errors (4 auto-fixable)                                │
│     • src/lib/components/UserProfile.svelte                            │
│       - Using deprecated 'on:click' syntax (3 instances)               │
│     • src/routes/account/settings/+page.svelte                         │
│       - Unused variable 'oldEmail' (1 instance)                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ RECOMMENDED ACTIONS ──────────────────────────────────────────────────┐
│                                                                        │
│  1. 🔧 Auto-fix linting errors:                                        │
│     npm run lint -- --fix                                              │
│                                                                        │
│  2. 🐛 Debug console errors:                                           │
│     • Add null check for user object in UserProfile.svelte:45          │
│     • Check API endpoint /api/users for server error                   │
│                                                                        │
│  3. ♻️  Or call code-refactorer agent:                                 │
│     Issues are complex enough to warrant specialized refactoring       │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║                    ❌ CANNOT COMPLETE - FIX ISSUES FIRST ❌              ║
║                                                                          ║
║                    Blocking Issues: 2 critical errors                    ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝

💡 Next steps:
   • Fix the issues above
   • Re-run /agent/verify to confirm fixes
   • Then proceed with /agent/complete
```

---

## Integration with Agent Workflow

### Automatic Verification

**Enhanced `/agent/complete`:**
```bash
/agent/complete
  → Auto-runs /agent/verify first
  → If passes: Continues with completion
  → If fails: Blocks completion, shows issues
```

**User can configure:**
```bash
/admin/configure
  → "Auto-verify before complete?" → Yes/No
  → "Verification mode" → Quick/Full/Smart
```

**Smart mode:**
- Detects if changes are frontend → Full verification
- Detects if changes are backend → Quick verification

### Manual Verification

```bash
# Before completing, manually verify
/agent/verify

# If passes
/agent/complete

# If fails, fix and re-verify
[fix issues]
/agent/verify
/agent/complete
```

---

## Best Practices

### For UI/Frontend Work

**ALWAYS use full verification:**
- Any Svelte component changes
- Any route/page changes
- Any styling changes
- Any user interaction changes

**Test thoroughly:**
- Happy path (expected usage)
- Error states (validation, network errors)
- Edge cases (empty data, max limits)
- Responsive design (mobile, tablet, desktop)

### For Backend/API Work

**Quick verification usually sufficient:**
- API endpoints (test separately with API client)
- Database queries
- Server utilities
- Background jobs

**But consider full if:**
- Changes affect error responses shown in UI
- Changes affect data displayed in browser
- Changes affect user permissions (test in browser)

### Performance Considerations

**Quick mode:**
- Fast (<30 seconds)
- Run frequently during development
- Before commits

**Full mode:**
- Slower (2-5 minutes depending on feature complexity)
- Run before task completion
- Run after major changes

**Optimization tips:**
- Keep dev server running (don't restart each time)
- Reuse browser page between verifications
- Use snapshots over screenshots when possible
- Test only affected routes/features

---

## Common Verification Scenarios

### Scenario 1: Simple Component Fix

```bash
# Fixed a button component
/agent/verify full
  → Page loads: ✅
  → Button clickable: ✅
  → Console clean: ✅
  → Visual check: ✅
  → PASSED

/agent/complete
```

### Scenario 2: Complex Form Implementation

```bash
# Built new user registration form
/agent/verify full
  → Fill all fields: ✅
  → Submit form: ❌ (500 error)
  → Console: ❌ (validation error)
  → FAILED

# Fix validation logic
[make changes]

/agent/verify full
  → Fill all fields: ✅
  → Submit form: ✅
  → Success message: ✅
  → PASSED

/agent/complete
```

### Scenario 3: Too Many Issues

```bash
# Large refactor, many issues
/agent/verify full
  → Type errors: 15
  → Console errors: 8
  → Network errors: 3
  → FAILED

# Too complex to fix quickly, call refactorer
# verification will invoke code-refactorer automatically
# refactorer fixes issues
# re-runs verification
  → PASSED

/agent/complete
```

---

**IMPORTANT:**
- Always verify before completing frontend work
- Use browser testing for anything user-facing
- Check console for errors - critical indicator
- Visual testing catches layout issues
- Self-correction loop prevents broken commits
- Full verification is comprehensive quality gate
