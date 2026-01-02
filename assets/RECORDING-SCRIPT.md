# Dashboard Demo Recording Script - MULTI-PROJECT

**Target:** 15-20 second MP4 for README hero section
**Projects:** jat-demo-api, jat-demo-ui, jat-demo-docs (showcasing cross-project orchestration)

---

## WHAT THIS DEMO SHOWS

**Key differentiator:** One dashboard, multiple projects, agents working across codebases simultaneously.

**The story:**
1. See tasks from 3 different projects in one view
2. Launch agents on different projects (API, UI, Docs)
3. Watch them work in parallel
4. Show the cross-project coordination power

---

## RESET (Run Before Each Take)

```bash
# 1. Reset all 3 demo projects
cd ~/code/jat-demo-api && git checkout -- . && git clean -fd
cd ~/code/jat-demo-ui && git checkout -- . && git clean -fd
cd ~/code/jat-demo-docs && git checkout -- . && git clean -fd

# 2. Reset beads tasks to open status (API)
cd ~/code/jat-demo-api
cat > .beads/issues.jsonl << 'EOF'
{"id":"jat-demo-api-4z9","title":"Add GET /users endpoint","description":"Implement REST API endpoint for fetching users list","status":"open","priority":0,"issue_type":"task","created_at":"2025-01-02T00:00:00.000000000-05:00","updated_at":"2025-01-02T00:00:00.000000000-05:00","labels":["api","backend"]}
EOF

# 3. Reset beads tasks (UI)
cd ~/code/jat-demo-ui
cat > .beads/issues.jsonl << 'EOF'
{"id":"jat-demo-ui-9zh","title":"Add UserList component","description":"React component to display users from API","status":"open","priority":1,"issue_type":"task","created_at":"2025-01-02T00:00:00.000000000-05:00","updated_at":"2025-01-02T00:00:00.000000000-05:00","labels":["ui","react"]}
EOF

# 4. Reset beads tasks (Docs)
cd ~/code/jat-demo-docs
cat > .beads/issues.jsonl << 'EOF'
{"id":"jat-demo-docs-4ld","title":"Document /users endpoint","description":"API documentation for GET /users","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-02T00:00:00.000000000-05:00","updated_at":"2025-01-02T00:00:00.000000000-05:00","labels":["docs"]}
EOF

# 5. Kill any running demo agents
tmux kill-session -t jat-ApiAgent 2>/dev/null
tmux kill-session -t jat-UiAgent 2>/dev/null
tmux kill-session -t jat-DocsAgent 2>/dev/null

echo "✅ Reset complete. Ready for recording."
```

---

## ONE-TIME SETUP (Before First Recording Session)

### 1. Start Dashboard
```bash
jat-dashboard
```

### 2. Show Only Demo Projects
1. Go to **http://127.0.0.1:3333/config**
2. Click **Projects** tab
3. For EACH real project (chimaro, jomarchy, jat, etc.):
   - Click the **eye icon** to hide it
4. Only these 3 should remain visible:
   - **jat-demo-api**
   - **jat-demo-ui**
   - **jat-demo-docs**

### 3. Size Browser Window
- Width: ~1440px (wider to show 3 projects)
- Height: ~900px
- Navigate to: **http://127.0.0.1:3333/work**

---

## RECORDING: Frame-by-Frame Instructions

**Start screen recorder BEFORE step 1**

### Frame 1 (0:00-0:04) - Cross-Project Task Overview
1. Browser shows `/work` route
2. **TaskTable** (bottom panel) shows tasks from ALL 3 PROJECTS:
   - `jat-demo-api-4z9` [P0] API - Open (blue badge)
   - `jat-demo-ui-9zh` [P1] UI - Open (green badge)
   - `jat-demo-docs-4ld` [P2] Docs - Open (purple badge)
3. **DO:** Slowly scroll/hover over task table to show project diversity
4. **WAIT:** 4 seconds - let viewers see "multiple projects, one dashboard"

### Frame 2 (0:04-0:07) - Launch Agents on Different Projects
1. **DO:** Click rocket 🚀 on `jat-demo-api-4z9` (API task)
2. **WAIT:** Agent spawns, session card appears
3. **DO:** Click rocket 🚀 on `jat-demo-ui-9zh` (UI task)
4. **WAIT:** Second agent spawns
5. **RESULT:** 2 session cards, different projects, both working

### Frame 3 (0:07-0:12) - Agents Working in Parallel
1. **SHOW:** Both session cards with "WORKING" status
   - ApiAgent working on API endpoint
   - UiAgent working on React component
2. **SHOW:** Terminal outputs streaming (different code in each)
3. **DO:** Maybe hover between the two sessions
4. **WAIT:** 5 seconds to show parallel execution

### Frame 4 (0:12-0:15) - Optional: Launch Third Agent
1. **DO:** Click rocket 🚀 on `jat-demo-docs-4ld` (Docs task)
2. **SHOW:** Third agent spawns
3. **RESULT:** 3 agents, 3 projects, all visible in one dashboard

### Frame 5 (0:15-0:18) - Show Project Badges
1. **DO:** Hover over session cards to highlight project names
2. **SHOW:** Each card shows which project it belongs to:
   - Session 1: jat-demo-api
   - Session 2: jat-demo-ui
   - Session 3: jat-demo-docs
3. **WAIT:** 3 seconds
4. **END RECORDING**

---

## ALTERNATIVE: Faster 12-Second Version

If 18 seconds is too long:

**Frame 1 (0-3s):** Show task table with 3 projects
**Frame 2 (3-5s):** Launch 2 agents quickly (API + UI)
**Frame 3 (5-10s):** Show both working in parallel
**Frame 4 (10-12s):** Pan to show project names, end

---

## STOP RECORDING

Use screen recorder's stop hotkey or click stop button.

---

## RETAKE CHECKLIST

If the take wasn't good:

1. Run the **RESET** script above
2. Refresh browser (F5)
3. Wait 2 seconds for dashboard to reload
4. Start recording again

---

## OUTPUT

**File location:** Save to `~/code/jat/assets/dashboard-demo.mp4`

**For GitHub README:**
1. Go to any GitHub issue in jat repo
2. Drag the MP4 file into the comment box
3. GitHub converts it and gives you a URL like:
   ```
   https://github.com/user-attachments/assets/abc123-def456.mp4
   ```
4. Add to README.md in the "Quick Start" or hero section

---

## KEY VISUALS CHECKLIST

Before submitting, verify the recording shows:

- [ ] **3 different projects** visible in task table
- [ ] **Project badges** on each task (different colors)
- [ ] **Multiple agents** working simultaneously
- [ ] **Different terminal outputs** (API code vs UI code vs docs)
- [ ] **Session cards** showing project names
- [ ] **Parallel execution** (key differentiator!)
- [ ] Smooth mouse movements (not jerky)
- [ ] 12-18 seconds total length

---

## MARKETING ANGLE

**The story this demo tells:**

> "You have a feature that touches API, UI, and docs. With JAT, you don't switch between 3 terminals - you see all 3 projects, spawn 3 agents, watch them work simultaneously. One dashboard. Full visibility. Complete control."

This is the killer demo for cross-project orchestration.
