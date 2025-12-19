/**
 * Shell Detection Patterns
 *
 * Shared patterns for detecting Claude Code readiness and shell prompts.
 * Used by session spawn/restart APIs to determine when Claude Code TUI
 * is ready to receive commands.
 */

/**
 * Patterns indicating Claude Code TUI is running and ready for input.
 * Match any of these in terminal output = Claude is ready.
 */
export const CLAUDE_READY_PATTERNS = [
	'Claude Code',
	'╭',
	'> ',
	'claude-opus',
	'claude-sonnet',
	'Opus',
	'Sonnet',
	'Type to stream'
];

/**
 * Patterns indicating we're at a shell prompt (Claude hasn't started).
 * Used to detect when Claude Code failed to start and we're stuck at bash/zsh.
 *
 * IMPORTANT: Only consider these as shell prompt if:
 * 1. Output does NOT contain 'claude' (case-insensitive)
 * 2. Enough time has passed (>3-5 seconds)
 *
 * This prevents false positives during Claude startup sequence.
 */
export const SHELL_PROMPT_PATTERNS = [
	'-bash:',           // bash error prefix
	'$ ',               // common bash prompt
	'bash-',            // bash version prefix
	'❯',                // zsh/powerline prompt
	'➜',                // oh-my-zsh default
	'%',                // zsh default prompt
	' on ',             // starship/powerline "dir on branch" format
	'master [',         // git branch indicators
	'main [',           // git branch indicators
	'jat on',           // specific to this user's prompt
	'No such file or directory'  // bash error when command not found
];
