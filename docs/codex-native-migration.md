## Codex-native Migration Plan (Codex-first, Claude-compatible)

This document is a **migration-oriented audit + plan** for making JAT **agent-agnostic**, with **Codex (codex-native) as the primary coding agent**, while preserving **Claude Code compatibility**.

### Goals

- **Codex-first:** `codex-native` is a first-class agent harness and the default fallback for new installs/configs.
- **Agent-agnostic orchestration:** Spawn/resume/auto-proceed, status signals, and completion metadata should not require Claude-specific hooks or slash commands.
- **Preserve Claude Code:** Keep `/jat:*` commands and `.claude/` hooks working as an optional adapter.

### Non-goals (for this migration)

- Perfect feature parity across every agent harness on day 1.
- Rewriting all historical Claude-oriented documentation in one sweep (we prefer “add agent-agnostic docs + incrementally de-Claude legacy docs”).

---

## Current Coupling Points (What makes JAT feel “Claude-tied”)

### 1) Slash-command workflow

- Many workflows (e.g. `/jat:start`, `/jat:complete`) exist as `commands/jat/*.md` and assume **Claude Code’s command system**.
- Codex does not support Claude’s slash-command mechanism, so Codex needs either:
  - a prompt-driven workflow, or
  - agent-agnostic scripts (`jat-step`, `jat-signal`, `jat-complete-bundle`) that Codex can run directly.

### 2) Hook-based signal persistence

- Historically, the IDE relied on **Claude PostToolUse hooks** to translate agent output into `/tmp` state files.
- Codex doesn’t run Claude hooks, so signals must be persisted by a **tool the agent can execute**, not by a Claude-only adapter.

### 3) Session identity + resume mapping

- Claude has a provider conversation UUID that can be discovered via `get-current-session-id` and persisted via `.claude/sessions/agent-*.txt`.
- Codex sessions can be resumed with `codex resume [SESSION_ID]` or `--last` (Codex CLI) and `codex-native tui --resume <SESSION_ID>` or `--resume-last` (codex-native), but capturing and persisting the right session identifier is not as mature as Claude’s hook-based mapping.

### 4) Internal IDE “utility LLM” calls

- Some IDE endpoints/services use Anthropic API or Claude CLI for summarization/commit message helpers.
- This is orthogonal to “agent harness orchestration”, but contributes to a Claude-centric feel.

---

## Target Architecture (What “agent-agnostic” looks like)

### A) Agent Programs (“harnesses”) as the single source of truth

- Agent harnesses live in `~/.config/jat/agents.json` and are edited via the IDE.
- A harness defines:
  - `command` (e.g. `codex-native`, `codex`, `claude`)
  - `models` + default model
  - `flags` (agent-specific CLI flags)
  - `taskInjection` strategy (argument vs prompt vs stdin)
  - auth mode (subscription / api key / none)

### B) Signals are written by `jat-signal` (tmux-first)

Principle: **the agent writes its own state** in a stable place the IDE can read.

- `jat-signal` writes:
  - `/tmp/jat-signal-tmux-{tmuxSession}.json` (current state)
  - `/tmp/jat-timeline-{tmuxSession}.jsonl` (append-only timeline)
  - `/tmp/jat-question-tmux-{tmuxSession}.json` (custom questions)
  - `.beads/signals/{taskId}.jsonl` (per-task timeline when possible)
- Claude hook remains as a *compat layer* that can still capture `[JAT-SIGNAL:*]` output, but should not duplicate events when `jat-signal` already wrote the authoritative files.

### C) Orchestration endpoints use harness config + routing rules

- Spawn is done through `/api/work/spawn`.
- Resume chooses the harness based on Agent Mail DB (authoritative) and uses:
  - `claude -r <session_id>` (Claude)
  - `codex resume [SESSION_ID]` or `--last` (Codex CLI)
  - `codex-native tui --resume <SESSION_ID>` or `--resume-last` (codex-native)
- Auto-proceed (epic swarm) should delegate to spawn so routing applies.

---

## Migration Phases (Actionable Steps)

### Phase 1 — Signals and State (agent-agnostic)

**Outcome:** Codex sessions update the IDE without any Claude hooks.

- Make `jat-signal` the *authoritative* writer for `/tmp/jat-signal-tmux-*` and `/tmp/jat-timeline-*`.
- Keep Claude hook as a compatibility adapter that:
  - still parses `[JAT-SIGNAL:*]` output for older flows
  - skips writing when a recent `writer: "jat-signal"` envelope is present

### Phase 2 — Spawn/Resume (Codex-first)

**Outcome:** IDE can spawn and resume Codex-native sessions reliably.

- Add `codex-native` preset and make it the default fallback for new configs.
- Note: `codex-native` currently does not ship a `login` subcommand; it can reuse credentials from `codex login` (writes `~/.codex/auth.json`) or use `OPENAI_API_KEY`/`--api-key`.
- Detect Codex auth in `~/.codex/auth.json` (supports multi-account via `active_account`).
- Make resume agent-agnostic, using Agent Mail DB’s `agents.program` field.

### Phase 3 — Auto-proceed (Epic Swarm) uses agent-agnostic spawn

**Outcome:** Auto-proceed spawns Codex-native (or routing-selected) sessions, not Claude-only sessions.

- Implement `/api/sessions/next` as a thin wrapper that:
  - kills completed tmux session
  - delegates spawn to `/api/work/spawn` (so routing rules apply)

### Phase 4 — Completion bundle generation is Codex-first

**Outcome:** Completion metadata is generated via Codex-native structured output (schema), with Claude/Anthropic as optional fallback.

- Provide `jat-complete-bundle` with provider selection:
  - prefer `codex-native run --schema ...`
  - fall back to `codex exec` if installed
  - optional Anthropic Messages API fallback when configured
- `jat-step complete` should emit the `complete` signal via `jat-signal complete "$BUNDLE_JSON"`.

### Phase 5 — Documentation + onboarding becomes agent-agnostic

**Outcome:** New users see Codex-first instructions without losing Claude docs.

- Keep `CLAUDE.md` and `commands/jat/*` (Claude adapter).
- Add/update docs that explain the agent-agnostic workflow:
  - signals: `shared/signals.md` (tmux-first)
  - harnesses: `shared/agent-programs.md` (include `codex-native`)
  - optional: add a dedicated `docs/codex-native.md` “how to run JAT with Codex-native”

### Phase 6 — (Optional) IDE utility LLM provider becomes pluggable

**Outcome:** “IDE helper LLM calls” are not pinned to Anthropic.

- Extend `ide/src/lib/server/llmService.ts` to support:
  - Codex-native CLI provider (using `codex-native run` with optional schema)
  - or OpenAI API provider (if desired)

---

## Compatibility Notes

### Claude Code

- Claude remains the best-supported harness for slash-command workflows.
- Claude hooks remain useful, but should be optional when `jat-signal` is used.

### Codex / codex-native

- Codex does not have Claude slash commands; prefer:
  - prompt-driven “start” behavior, and
  - agent-agnostic scripts (`jat-signal`, `jat-step`, `jat-complete-bundle`).
- Resume is best with explicit session ids; `--last`/`--resume-last` fallback is acceptable but may be ambiguous if you have multiple Codex sessions.

