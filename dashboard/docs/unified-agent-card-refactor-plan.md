# UnifiedAgentCard Refactor Plan

## Overview

Merge `AgentCard` (~2000 lines) and `WorkCard` (~2359 lines) into a single `UnifiedAgentCard` component with multiple display modes. This consolidates ~4300 lines into ~2500 lines while increasing functionality.

## Current State Analysis

### AgentCard Features (to preserve)
```
Identity & Status:
- Agent name, avatar (AgentAvatar component)
- Status badge (live/working/active/idle/connecting/disconnected/offline)
- Highlight state (isHighlighted prop)

Task Management:
- Current task display with priority badge
- Task queue with drag-drop assignment
- Dependency conflict detection
- File reservation conflict detection
- Task progress estimation

Token Usage:
- Sparkline visualization (hourly data)
- Today/week token counts and costs
- High usage warnings
- Stale data detection with retry

Session Controls:
- Kill session
- Send interrupt (Ctrl+C)
- Send continue
- Slash command dropdown (/jat:complete, /jat:pause, etc.)

Communication:
- View inbox messages
- Send message to agent
- View/release file reservations

Queue Management:
- Clear queue confirmation
- Unassign current task

Activity Feed:
- Recent activities with timestamps
- Activity click → task drawer

Terminal Output (collapsible tab):
- Fetch and display output
- ANSI color rendering
- Output polling
```

### WorkCard Features (to preserve)
```
Identity & Status:
- Session name, agent name
- Session state detection from output
  (starting/working/needs-input/review/completing/completed/idle)
- State-based accent colors and animations

Task Display:
- Current task or last completed task
- Inline title editing
- Task click → drawer
- Priority/type badges

Terminal Output:
- Full terminal viewer with ANSI rendering
- Auto-scroll with toggle
- Scroll position detection
- Container resize handling
- Tmux session resize sync

Input System:
- Text input field with send
- Key sending (Enter, Escape, arrows)
- Paste handling (text and images)
- Voice transcription integration
- Image attachment and upload

Question UI (Smart Questions):
- Parse Claude Code question options
- Render as clickable buttons
- Multi-select support
- Option number sending

Session Controls:
- Kill session
- Interrupt (Ctrl+C)
- Continue
- Attach terminal (open in tmux)

Workflow Commands:
- Status action badge with dropdown
- Contextual actions per state

Token Usage:
- Sparkline display
- Cost display
- Token counters

Resizing:
- Manual card width resize
- Tmux column sync on resize
```

### Feature Overlap (consolidate)
```
Shared:
- Agent/session identity display
- Status/state badges
- Token usage + sparklines
- Session controls (kill, interrupt, continue)
- Task display with click handler
- Highlighted state
- ANSI output rendering

Different implementations:
- AgentCard: agentStatusUtils (time-based)
- WorkCard: sessionState (output-based)
→ UNIFY into single state model

AgentCard only:
- Task queue with drag-drop
- Conflict detection
- Inbox/reservations modals
- Activity feed

WorkCard only:
- Full terminal output
- Input system
- Question UI
- Title editing
- Card resizing
```

## Unified Architecture

### File Structure
```
src/lib/components/agent/
├── UnifiedAgentCard.svelte          # Main component (~800 lines)
├── index.ts                          # Exports
│
├── header/
│   ├── AgentHeader.svelte           # Name + avatar + state badge (~150 lines)
│   └── StateBadge.svelte            # State indicator + actions (~200 lines)
│
├── task/
│   ├── CurrentTask.svelte           # Active task display (~150 lines)
│   ├── TaskQueue.svelte             # Queue with drag-drop (~300 lines)
│   └── TaskQueueItem.svelte         # Single queue item (~80 lines)
│
├── terminal/
│   ├── TerminalOutput.svelte        # Output viewer (~250 lines)
│   ├── TerminalInput.svelte         # Input field + controls (~200 lines)
│   └── QuestionUI.svelte            # Smart question buttons (~150 lines)
│
├── metrics/
│   ├── TokenUsageBar.svelte         # Sparkline + costs (~120 lines)
│   └── ActivityFeed.svelte          # Recent activities (~150 lines)
│
├── modals/
│   ├── InboxModal.svelte            # View messages (~100 lines)
│   ├── ReservationsModal.svelte     # View/release locks (~120 lines)
│   └── SendMessageModal.svelte      # Compose message (~100 lines)
│
└── actions/
    ├── SessionControls.svelte       # Kill/interrupt/continue (~100 lines)
    ├── QuickActionsMenu.svelte      # Context menu (~150 lines)
    └── SlashCommandDropdown.svelte  # Workflow commands (~100 lines)

src/lib/utils/
├── unifiedAgentState.ts             # Combined state logic (~200 lines)
├── sessionStateDetection.ts         # Output parsing (extract from WorkCard)
└── conflictDetection.ts             # File/dependency conflicts (extract from AgentCard)

src/lib/config/
└── agentCardConfig.ts               # Display mode configs, thresholds
```

### Display Modes

```typescript
type DisplayMode = 'mini' | 'compact' | 'standard' | 'expanded';

interface DisplayModeConfig {
  showAvatar: boolean;
  showStateBadge: boolean;
  showTask: boolean;
  showTaskDetails: boolean;      // description, labels
  showQueue: boolean;
  showTerminal: boolean;
  showInput: boolean;
  showQuestionUI: boolean;
  showTokenUsage: boolean;
  showSparkline: boolean;
  showActivityFeed: boolean;
  showSessionControls: boolean;
  showQuickActions: boolean;
  allowResize: boolean;
  allowDragDrop: boolean;        // queue drag-drop
}

const DISPLAY_MODES: Record<DisplayMode, DisplayModeConfig> = {
  mini: {
    // Kanban swimlane item - minimal
    showAvatar: false,
    showStateBadge: true,
    showTask: true,
    showTaskDetails: false,
    showQueue: false,
    showTerminal: false,
    showInput: false,
    showQuestionUI: false,
    showTokenUsage: false,
    showSparkline: false,
    showActivityFeed: false,
    showSessionControls: false,
    showQuickActions: false,
    allowResize: false,
    allowDragDrop: false,
  },
  compact: {
    // Kanban card - summary with actions
    showAvatar: true,
    showStateBadge: true,
    showTask: true,
    showTaskDetails: false,
    showQueue: false,
    showTerminal: false,
    showInput: false,
    showQuestionUI: true,        // Show if needs-input
    showTokenUsage: true,
    showSparkline: false,
    showActivityFeed: false,
    showSessionControls: true,
    showQuickActions: true,
    allowResize: false,
    allowDragDrop: false,
  },
  standard: {
    // Agent grid - full card without terminal
    showAvatar: true,
    showStateBadge: true,
    showTask: true,
    showTaskDetails: true,
    showQueue: true,
    showTerminal: false,         // Collapsed by default
    showInput: false,
    showQuestionUI: true,
    showTokenUsage: true,
    showSparkline: true,
    showActivityFeed: true,
    showSessionControls: true,
    showQuickActions: true,
    allowResize: false,
    allowDragDrop: true,
  },
  expanded: {
    // Work session - full terminal view
    showAvatar: true,
    showStateBadge: true,
    showTask: true,
    showTaskDetails: true,
    showQueue: false,            // Not needed in work view
    showTerminal: true,
    showInput: true,
    showQuestionUI: true,
    showTokenUsage: true,
    showSparkline: true,
    showActivityFeed: false,     // Terminal replaces this
    showSessionControls: true,
    showQuickActions: true,
    allowResize: true,
    allowDragDrop: false,
  },
};
```

### Unified State Model

```typescript
// src/lib/utils/unifiedAgentState.ts

/**
 * Connection state - is the tmux session alive?
 */
type ConnectionState = 'connected' | 'disconnected' | 'offline';

/**
 * Activity state - what is the agent doing?
 * Detected from output parsing when connected,
 * inferred from timestamps when disconnected.
 */
type ActivityState =
  | 'starting'        // Session just created, initializing
  | 'working'         // Actively coding
  | 'needs-input'     // Waiting for user response
  | 'ready-for-review'// Asking to mark complete
  | 'completing'      // Running /jat:complete
  | 'completed'       // Task finished
  | 'idle';           // No active task

/**
 * Unified agent state combining connection + activity
 */
interface UnifiedAgentState {
  connection: ConnectionState;
  activity: ActivityState;

  // Derived convenience properties
  isOnline: boolean;           // connection === 'connected'
  isWorking: boolean;          // activity === 'working'
  isBlocked: boolean;          // activity === 'needs-input'
  needsAttention: boolean;     // needs-input || ready-for-review
  canInteract: boolean;        // isOnline && activity !== 'completing'
  canAssignTasks: boolean;     // isOnline && (idle || completed)

  // For UI display
  stateLabel: string;          // "Working", "Needs Input", etc.
  stateIcon: string;           // SVG path
  stateColor: string;          // oklch color
  statePulse: boolean;         // Should badge pulse?
}

/**
 * Compute unified state from agent data + optional output
 */
function computeUnifiedState(
  agent: AgentData,
  output?: string,
  lastCompletedTask?: Task
): UnifiedAgentState {
  // 1. Determine connection state
  const connection = computeConnectionState(agent);

  // 2. Determine activity state
  let activity: ActivityState;
  if (connection === 'connected' && output) {
    // Parse output for state markers (from WorkCard logic)
    activity = detectActivityFromOutput(output, agent.task, lastCompletedTask);
  } else if (connection === 'disconnected') {
    // Infer from last known state
    activity = agent.task ? 'working' : 'idle';
  } else {
    activity = 'idle';
  }

  // 3. Build unified state object
  return buildUnifiedState(connection, activity);
}
```

### UnifiedAgentCard Props

```typescript
interface UnifiedAgentCardProps {
  // Required
  agent: AgentData;
  mode: DisplayMode;

  // Optional data (mode determines what's used)
  tasks?: Task[];              // For queue display
  allTasks?: Task[];           // For conflict detection
  reservations?: Reservation[];
  output?: string;             // Terminal output
  lastCompletedTask?: Task;    // For completion state
  sparklineData?: SparklinePoint[];

  // Event handlers
  onTaskClick?: (taskId: string) => void;
  onTaskAssign?: (taskId: string, agentName: string) => Promise<void>;
  onKillSession?: () => void;
  onInterrupt?: () => void;
  onContinue?: () => void;
  onSendInput?: (input: string, type: InputType) => Promise<void>;
  onAttachTerminal?: () => void;
  onDismiss?: () => void;

  // Drag-drop
  draggedTaskId?: string | null;

  // Display options
  isHighlighted?: boolean;
  cardWidth?: number;
  onWidthChange?: (width: number) => void;
  class?: string;
}
```

## Implementation Phases

### Phase 1: Foundation (Day 1)
**Goal: Create shared utilities and types**

```
Tasks:
1.1 Create src/lib/types/agent.ts
    - Consolidate Agent, Task, Reservation types
    - Add UnifiedAgentState interface
    - Add DisplayMode types

1.2 Create src/lib/utils/unifiedAgentState.ts
    - Extract computeConnectionState from agentStatusUtils
    - Extract detectActivityFromOutput from WorkCard
    - Implement computeUnifiedState
    - Add state helper functions

1.3 Create src/lib/utils/sessionStateDetection.ts
    - Extract findLastPos function from WorkCard
    - Extract all pattern matching logic
    - Make patterns configurable

1.4 Create src/lib/utils/conflictDetection.ts
    - Extract detectConflicts from AgentCard
    - Extract patternsConflict from AgentCard
    - Extract inferFilePatterns from AgentCard

1.5 Create src/lib/config/agentCardConfig.ts
    - Define DISPLAY_MODES config
    - Define state visual mappings
    - Define action configurations per state

Tests:
- Unit tests for unifiedAgentState
- Unit tests for sessionStateDetection
- Unit tests for conflictDetection
```

### Phase 2: Sub-Components (Day 2-3)
**Goal: Extract reusable pieces**

```
Tasks:
2.1 Create header/AgentHeader.svelte
    - Agent name display
    - AgentAvatar integration
    - Online/offline indicator dot
    - Props: agent, isOnline, isHighlighted, size

2.2 Create header/StateBadge.svelte
    - State label + icon
    - Color from state
    - Pulse animation for attention states
    - Click → actions dropdown
    - Props: state, actions, onAction

2.3 Create task/CurrentTask.svelte
    - Task title (with inline edit in expanded mode)
    - Task ID badge
    - Priority/type badges
    - Click handler
    - Props: task, editable, onClick, onTitleChange

2.4 Create task/TaskQueue.svelte
    - Queue section header with count
    - Drag-drop zone
    - Conflict detection display
    - Empty state
    - Props: tasks, agent, onAssign, draggedTaskId

2.5 Create task/TaskQueueItem.svelte
    - Single queue item
    - Priority badge
    - Drag handle
    - Props: task, onClick

2.6 Create terminal/TerminalOutput.svelte
    - ANSI rendering
    - Auto-scroll with toggle
    - Scroll position tracking
    - Container resize handling
    - Props: output, autoScroll, onScrollChange

2.7 Create terminal/TerminalInput.svelte
    - Text input field
    - Send button
    - Key buttons (Enter, Escape, etc.)
    - Paste handling
    - Voice button integration
    - Props: onSend, onKey, disabled

2.8 Create terminal/QuestionUI.svelte
    - Parse question data
    - Render option buttons
    - Multi-select support
    - Props: questionData, onSelect, onConfirm

2.9 Create metrics/TokenUsageBar.svelte
    - Sparkline component
    - Token count display
    - Cost display
    - High usage warning
    - Props: sparklineData, tokens, cost, showWarning

2.10 Create metrics/ActivityFeed.svelte
    - Activity list
    - Timestamp formatting
    - Activity click handler
    - Props: activities, onActivityClick

2.11 Create modals/InboxModal.svelte
    - Message list
    - Read/unread state
    - Props: messages, isOpen, onClose

2.12 Create modals/ReservationsModal.svelte
    - Reservation list
    - Release button per item
    - Props: reservations, isOpen, onClose, onRelease

2.13 Create modals/SendMessageModal.svelte
    - Subject/body inputs
    - Send button
    - Props: isOpen, onClose, onSend

2.14 Create actions/SessionControls.svelte
    - Kill, Interrupt, Continue buttons
    - Loading states
    - Props: onKill, onInterrupt, onContinue, disabled

2.15 Create actions/QuickActionsMenu.svelte
    - Context menu positioning
    - Action items from state config
    - Props: actions, position, onAction, onClose

2.16 Create actions/SlashCommandDropdown.svelte
    - Command list
    - Send command handler
    - Props: commands, onCommand, disabled
```

### Phase 3: UnifiedAgentCard (Day 4-5)
**Goal: Build the main component**

```
Tasks:
3.1 Create UnifiedAgentCard.svelte structure
    - Props interface
    - Mode-based rendering logic
    - State computation using unifiedAgentState

3.2 Implement mini mode
    - Minimal layout
    - State badge + task title only
    - Used in kanban swimlanes

3.3 Implement compact mode
    - Avatar + header
    - Current task
    - Token usage (no sparkline)
    - Session controls
    - Used in kanban cards

3.4 Implement standard mode
    - Full header with state badge
    - Current task with details
    - Task queue with drag-drop
    - Sparkline + token usage
    - Activity feed
    - All modals
    - Used in agent grid

3.5 Implement expanded mode
    - Full header
    - Current task with edit
    - Terminal output
    - Terminal input + question UI
    - Token usage + sparkline
    - Session controls
    - Card resizing
    - Used in work sessions

3.6 Add transitions between modes
    - Smooth animations
    - State preservation on mode change

3.7 Create index.ts exports
    - Export UnifiedAgentCard
    - Export sub-components
    - Export types
```

### Phase 4: Page Integration (Day 6-7)
**Goal: Replace old components with unified card**

```
Tasks:
4.1 Update /agents page
    - Import UnifiedAgentCard
    - Replace AgentCard with UnifiedAgentCard mode="standard"
    - Verify all features work
    - Test drag-drop assignment

4.2 Update /tasks page
    - Import UnifiedAgentCard
    - Replace WorkCard with UnifiedAgentCard mode="expanded"
    - Verify terminal output works
    - Test input system
    - Test question UI

4.3 Create /kanban page
    - Fetch work sessions
    - Group by activity state
    - Render UnifiedAgentCard mode="compact" in columns
    - Add column headers with counts

4.4 Update any other usages
    - Search for AgentCard imports
    - Search for WorkCard imports
    - Update all references

4.5 Delete old components
    - Remove AgentCard.svelte
    - Remove WorkCard.svelte
    - Clean up orphaned imports
```

### Phase 5: Kanban Enhancements (Day 8)
**Goal: Full-featured kanban board**

```
Tasks:
5.1 Kanban column configuration
    - Starting, Working, Needs Input, Review, Completing, Done
    - Column colors from SESSION_STATE_VISUALS
    - Collapsible columns

5.2 Add session counts per column
    - Live updating counts
    - Visual indicators

5.3 Add filtering
    - Filter by project
    - Filter by priority
    - Search by agent/task

5.4 Optional: Drag between columns
    - Drag card to different state
    - API call to update state
    - (May not make sense for all transitions)

5.5 Auto-refresh
    - Poll for session updates
    - Smooth card movement on state change
```

### Phase 6: Polish & Cleanup (Day 9-10)
**Goal: Final touches and documentation**

```
Tasks:
6.1 Performance optimization
    - Memo expensive computations
    - Lazy load terminal output
    - Virtualize long lists

6.2 Accessibility
    - Keyboard navigation
    - ARIA labels
    - Focus management

6.3 Responsive design
    - Mobile layout adjustments
    - Touch-friendly interactions

6.4 Documentation
    - Update CLAUDE.md with new architecture
    - Component API documentation
    - Usage examples

6.5 Final testing
    - Cross-browser testing
    - Edge cases
    - Performance profiling
```

## Migration Checklist

### Before Starting
- [ ] Create feature branch: `feature/unified-agent-card`
- [ ] Ensure all tests pass on current code
- [ ] Take screenshots of current UI for comparison

### Phase 1 Checklist
- [ ] Types consolidated in src/lib/types/agent.ts
- [ ] unifiedAgentState.ts working with tests
- [ ] sessionStateDetection.ts extracted with tests
- [ ] conflictDetection.ts extracted with tests
- [ ] agentCardConfig.ts complete

### Phase 2 Checklist
- [ ] AgentHeader.svelte renders correctly
- [ ] StateBadge.svelte shows correct states
- [ ] CurrentTask.svelte displays task info
- [ ] TaskQueue.svelte handles drag-drop
- [ ] TerminalOutput.svelte renders ANSI
- [ ] TerminalInput.svelte sends input
- [ ] QuestionUI.svelte shows options
- [ ] TokenUsageBar.svelte displays metrics
- [ ] ActivityFeed.svelte shows activities
- [ ] All modals working
- [ ] All action components working

### Phase 3 Checklist
- [ ] UnifiedAgentCard renders in mini mode
- [ ] UnifiedAgentCard renders in compact mode
- [ ] UnifiedAgentCard renders in standard mode
- [ ] UnifiedAgentCard renders in expanded mode
- [ ] Mode transitions smooth

### Phase 4 Checklist
- [ ] /agents page works with new component
- [ ] /tasks page works with new component
- [ ] /kanban page created and working
- [ ] Old components deleted
- [ ] No console errors
- [ ] All features preserved

### Phase 5 Checklist
- [ ] Kanban columns configured
- [ ] Session counts updating
- [ ] Filtering working
- [ ] Auto-refresh working

### Phase 6 Checklist
- [ ] Performance acceptable
- [ ] Accessibility audit passed
- [ ] Mobile layout works
- [ ] Documentation updated
- [ ] All tests passing

## Risk Mitigation

### Risk: Feature regression
**Mitigation**: Detailed feature audit (done above), side-by-side testing

### Risk: Performance degradation
**Mitigation**: Profile before/after, lazy loading, memoization

### Risk: Breaking changes to API
**Mitigation**: Keep props interface compatible where possible

### Risk: Scope creep
**Mitigation**: Strict phase boundaries, no new features until migration complete

## Success Metrics

1. **Lines of code**: ~4300 → ~2500 (40% reduction)
2. **Component count**: 2 large → 1 main + 16 small (better modularity)
3. **Feature parity**: 100% of existing features preserved
4. **New features**: Kanban view, mode transitions
5. **Test coverage**: Unit tests for all utilities
6. **Performance**: No regression in render time

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Foundation | 1 day | Shared utilities |
| 2. Sub-Components | 2 days | 16 components |
| 3. UnifiedAgentCard | 2 days | Main component |
| 4. Page Integration | 2 days | All pages updated |
| 5. Kanban | 1 day | Kanban page |
| 6. Polish | 2 days | Final product |
| **Total** | **10 days** | Complete refactor |

## Appendix: Component Size Estimates

| Component | Lines | Notes |
|-----------|-------|-------|
| UnifiedAgentCard.svelte | 800 | Main orchestrator |
| AgentHeader.svelte | 150 | |
| StateBadge.svelte | 200 | Includes dropdown |
| CurrentTask.svelte | 150 | |
| TaskQueue.svelte | 300 | Drag-drop logic |
| TaskQueueItem.svelte | 80 | |
| TerminalOutput.svelte | 250 | ANSI + scroll |
| TerminalInput.svelte | 200 | Input + keys |
| QuestionUI.svelte | 150 | Option buttons |
| TokenUsageBar.svelte | 120 | |
| ActivityFeed.svelte | 150 | |
| InboxModal.svelte | 100 | |
| ReservationsModal.svelte | 120 | |
| SendMessageModal.svelte | 100 | |
| SessionControls.svelte | 100 | |
| QuickActionsMenu.svelte | 150 | |
| SlashCommandDropdown.svelte | 100 | |
| **Total Components** | **~2720** | |
| unifiedAgentState.ts | 200 | |
| sessionStateDetection.ts | 150 | |
| conflictDetection.ts | 150 | |
| agentCardConfig.ts | 100 | |
| **Total Utilities** | **~600** | |
| **Grand Total** | **~3320** | vs ~4359 current |
