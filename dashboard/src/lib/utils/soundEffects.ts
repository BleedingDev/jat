/**
 * Sound effects for the dashboard using Web Audio API
 * Generates sounds programmatically without external audio files
 *
 * Sound preference is managed by the unified preferences store.
 * This module provides the Web Audio API implementation.
 */

import {
	getSoundsEnabled,
	setSoundsEnabled
} from '$lib/stores/preferences.svelte';

let audioContext: AudioContext | null = null;

/**
 * Check if sounds are enabled (delegates to preferences store)
 */
export function areSoundsEnabled(): boolean {
	return getSoundsEnabled();
}

/**
 * Enable sounds (call after user grants permission)
 */
export function enableSounds(): void {
	setSoundsEnabled(true);
	// Initialize audio context
	const ctx = getAudioContext();
	if (ctx && ctx.state === 'suspended') {
		ctx.resume().catch(() => {});
	}
}

/**
 * Disable sounds
 */
export function disableSounds(): void {
	setSoundsEnabled(false);
}

/**
 * Get or create the audio context (lazy initialization)
 * Audio context must be created after user interaction in modern browsers
 */
function getAudioContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;

	if (!audioContext) {
		try {
			audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
		} catch (e) {
			// Silently fail - audio not critical
			return null;
		}
	}
	return audioContext;
}

/**
 * Initialize audio context on first user interaction
 * Call this from a click handler to enable sounds
 */
export function initAudioOnInteraction(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (ctx && ctx.state === 'suspended') {
		ctx.resume().catch(() => {
			// Ignore errors - audio not critical
		});
	}
}

/**
 * Play a pleasant two-tone chime for new task notifications
 * Creates a soft, non-intrusive notification sound
 */
export function playNewTaskChime(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	// Resume audio context if suspended (required after user interaction)
	if (ctx.state === 'suspended') {
		ctx.resume().then(() => {
			playChimeTones(ctx);
		}).catch(() => {
			// Audio context couldn't resume - needs user interaction
		});
		return;
	}

	playChimeTones(ctx);
}

function playChimeTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.15; // Keep it subtle

	// First tone (higher pitch)
	playTone(ctx, 880, now, 0.1, volume); // A5

	// Second tone (lower, slightly delayed)
	playTone(ctx, 659.25, now + 0.1, 0.15, volume * 0.8); // E5
}

/**
 * Play a single tone with envelope
 */
function playTone(
	ctx: AudioContext,
	frequency: number,
	startTime: number,
	duration: number,
	volume: number
): void {
	// Create oscillator for the tone
	const oscillator = ctx.createOscillator();
	oscillator.type = 'sine';
	oscillator.frequency.setValueAtTime(frequency, startTime);

	// Create gain node for volume envelope
	const gainNode = ctx.createGain();
	gainNode.gain.setValueAtTime(0, startTime);
	gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01); // Quick attack
	gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Smooth decay

	// Connect nodes
	oscillator.connect(gainNode);
	gainNode.connect(ctx.destination);

	// Play the tone
	oscillator.start(startTime);
	oscillator.stop(startTime + duration + 0.1);
}

/**
 * Play a "starting work" sound when a task begins (status -> in_progress)
 * Creates an energetic, activating tone
 */
export function playTaskStartSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => {
			playStartTones(ctx);
		}).catch(() => {});
		return;
	}

	playStartTones(ctx);
}

function playStartTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.12;

	// Quick ascending "power up" sound
	playTone(ctx, 392, now, 0.08, volume * 0.7); // G4
	playTone(ctx, 523.25, now + 0.06, 0.08, volume * 0.85); // C5
	playTone(ctx, 659.25, now + 0.12, 0.1, volume); // E5
	playTone(ctx, 783.99, now + 0.18, 0.15, volume * 1.1); // G5
}

/**
 * Play a success sound (task completed, etc.)
 */
export function playSuccessChime(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume();
	}

	const now = ctx.currentTime;
	const volume = 0.12;

	// Rising three-tone pattern
	playTone(ctx, 523.25, now, 0.08, volume); // C5
	playTone(ctx, 659.25, now + 0.08, 0.08, volume); // E5
	playTone(ctx, 783.99, now + 0.16, 0.15, volume * 1.2); // G5
}

/**
 * Play an error/warning sound
 */
export function playErrorSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume();
	}

	const now = ctx.currentTime;
	const volume = 0.1;

	// Two descending tones
	playTone(ctx, 440, now, 0.1, volume); // A4
	playTone(ctx, 349.23, now + 0.12, 0.15, volume); // F4
}

/**
 * Play a soft "whoosh" sound for task removal/exit
 */
export function playTaskExitSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => {
			playExitTones(ctx);
		}).catch(() => {
			// Audio context couldn't resume - needs user interaction
		});
		return;
	}

	playExitTones(ctx);
}

function playExitTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.12; // Slightly louder than before

	// Quick descending sweep - more noticeable
	playTone(ctx, 587.33, now, 0.08, volume); // D5
	playTone(ctx, 440, now + 0.07, 0.1, volume * 0.8); // A4
	playTone(ctx, 329.63, now + 0.15, 0.12, volume * 0.6); // E4
}

/**
 * Play a celebratory completion sound when a task is closed/completed
 * Creates a satisfying "achievement" sound
 */
export function playTaskCompleteSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => {
			playCompleteTones(ctx);
		}).catch(() => {});
		return;
	}

	playCompleteTones(ctx);
}

function playCompleteTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.14;

	// Celebratory rising arpeggio with a final high note
	playTone(ctx, 523.25, now, 0.1, volume * 0.8); // C5
	playTone(ctx, 659.25, now + 0.08, 0.1, volume * 0.9); // E5
	playTone(ctx, 783.99, now + 0.16, 0.1, volume); // G5
	playTone(ctx, 1046.5, now + 0.24, 0.2, volume * 1.1); // C6 - high finish
}

/**
 * Play a welcoming sound when a new agent joins the swarm
 * Creates an ascending arpeggio with a sparkle finish
 */
export function playAgentJoinSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => {
			playJoinTones(ctx);
		}).catch(() => {});
		return;
	}

	playJoinTones(ctx);
}

function playJoinTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.12;

	// Welcoming ascending arpeggio with a "sparkle" finish
	playTone(ctx, 523.25, now, 0.1, volume * 0.7);        // C5
	playTone(ctx, 659.25, now + 0.08, 0.1, volume * 0.8); // E5
	playTone(ctx, 783.99, now + 0.16, 0.1, volume * 0.9); // G5
	playTone(ctx, 1046.5, now + 0.24, 0.12, volume);      // C6
	playTone(ctx, 1318.5, now + 0.32, 0.18, volume * 0.6); // E6 - sparkle
}

// =============================================================================
// SESSION ACTION SOUNDS
// =============================================================================

/**
 * Play a cleanup/removal sound - soft descending sweep
 * Used when cleaning up sessions or removing items
 */
export function playCleanupSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playCleanupTones(ctx)).catch(() => {});
		return;
	}

	playCleanupTones(ctx);
}

function playCleanupTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.10;

	// Soft descending "whoosh away" - gentler than exit
	playTone(ctx, 698.46, now, 0.06, volume * 0.8);       // F5
	playTone(ctx, 523.25, now + 0.05, 0.08, volume * 0.6); // C5
	playTone(ctx, 392, now + 0.11, 0.1, volume * 0.4);    // G4
}

/**
 * Play a kill/terminate sound - sharp warning tone
 * Used when forcefully terminating sessions
 */
export function playKillSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playKillTones(ctx)).catch(() => {});
		return;
	}

	playKillTones(ctx);
}

function playKillTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.12;

	// Sharp descending warning - two quick notes
	playTone(ctx, 493.88, now, 0.08, volume);        // B4
	playTone(ctx, 293.66, now + 0.1, 0.12, volume);  // D4 - low finish
}

/**
 * Play an attach/connect sound - quick connection beep
 * Used when attaching to terminals
 */
export function playAttachSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playAttachTones(ctx)).catch(() => {});
		return;
	}

	playAttachTones(ctx);
}

function playAttachTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.10;

	// Quick "connection" beep - two rising tones
	playTone(ctx, 440, now, 0.05, volume * 0.7);         // A4
	playTone(ctx, 554.37, now + 0.06, 0.08, volume);     // C#5
}

/**
 * Play an interrupt sound - short staccato halt
 * Used when sending Ctrl+C or escape
 */
export function playInterruptSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playInterruptTones(ctx)).catch(() => {});
		return;
	}

	playInterruptTones(ctx);
}

function playInterruptTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.11;

	// Short staccato "halt" - single sharp tone
	playTone(ctx, 523.25, now, 0.04, volume);  // C5 - quick blip
}

// =============================================================================
// SERVER CONTROL SOUNDS
// =============================================================================

/**
 * Play a server start sound - ascending boot up
 * Used when starting dev servers
 */
export function playServerStartSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playServerStartTones(ctx)).catch(() => {});
		return;
	}

	playServerStartTones(ctx);
}

function playServerStartTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.11;

	// Ascending "boot up" - electronic feel
	playTone(ctx, 261.63, now, 0.06, volume * 0.6);       // C4
	playTone(ctx, 329.63, now + 0.05, 0.06, volume * 0.7); // E4
	playTone(ctx, 392, now + 0.10, 0.06, volume * 0.8);   // G4
	playTone(ctx, 523.25, now + 0.15, 0.1, volume);       // C5
}

/**
 * Play a server stop sound - descending power down
 * Used when stopping servers
 */
export function playServerStopSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playServerStopTones(ctx)).catch(() => {});
		return;
	}

	playServerStopTones(ctx);
}

function playServerStopTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.10;

	// Descending "power down"
	playTone(ctx, 523.25, now, 0.06, volume);            // C5
	playTone(ctx, 392, now + 0.05, 0.06, volume * 0.8);  // G4
	playTone(ctx, 329.63, now + 0.10, 0.06, volume * 0.6); // E4
	playTone(ctx, 261.63, now + 0.15, 0.12, volume * 0.4); // C4
}

// =============================================================================
// ATTENTION/NOTIFICATION SOUNDS
// =============================================================================

/**
 * Play a needs-input sound - attention grabbing
 * Used when agent needs user input
 */
export function playNeedsInputSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playNeedsInputTones(ctx)).catch(() => {});
		return;
	}

	playNeedsInputTones(ctx);
}

function playNeedsInputTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.13;

	// Attention-grabbing double chime - "look at me"
	playTone(ctx, 880, now, 0.08, volume);          // A5
	playTone(ctx, 880, now + 0.12, 0.08, volume);   // A5 repeat
	playTone(ctx, 1046.5, now + 0.24, 0.1, volume * 0.8); // C6 - question inflection
}

/**
 * Play a ready-for-review sound - check this out
 * Used when agent is ready for user review
 */
export function playReadyForReviewSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playReadyForReviewTones(ctx)).catch(() => {});
		return;
	}

	playReadyForReviewTones(ctx);
}

function playReadyForReviewTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.12;

	// Pleasant "check this out" - ascending with flourish
	playTone(ctx, 659.25, now, 0.08, volume * 0.7);       // E5
	playTone(ctx, 783.99, now + 0.07, 0.08, volume * 0.85); // G5
	playTone(ctx, 987.77, now + 0.14, 0.12, volume);      // B5
}

// =============================================================================
// DRAG-DROP SOUNDS
// =============================================================================

/**
 * Play a pickup sound - subtle lift
 * Used when starting to drag an item
 */
export function playPickupSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playPickupTones(ctx)).catch(() => {});
		return;
	}

	playPickupTones(ctx);
}

function playPickupTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.08; // Very subtle

	// Quick upward blip
	playTone(ctx, 587.33, now, 0.04, volume);  // D5
}

/**
 * Play a drop sound - satisfying place
 * Used when successfully dropping an item
 */
export function playDropSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playDropTones(ctx)).catch(() => {});
		return;
	}

	playDropTones(ctx);
}

function playDropTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.10;

	// Satisfying "placed" sound
	playTone(ctx, 659.25, now, 0.05, volume * 0.8);  // E5
	playTone(ctx, 523.25, now + 0.05, 0.08, volume); // C5
}

// =============================================================================
// VOICE INPUT SOUNDS
// =============================================================================

/**
 * Play recording start sound - beep
 * Used when voice recording starts
 */
export function playRecordingStartSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playRecordingStartTones(ctx)).catch(() => {});
		return;
	}

	playRecordingStartTones(ctx);
}

function playRecordingStartTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.10;

	// Single recording beep
	playTone(ctx, 880, now, 0.08, volume);  // A5
}

/**
 * Play recording stop sound - double beep
 * Used when voice recording stops
 */
export function playRecordingStopSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playRecordingStopTones(ctx)).catch(() => {});
		return;
	}

	playRecordingStopTones(ctx);
}

function playRecordingStopTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.10;

	// Double beep to indicate stop
	playTone(ctx, 880, now, 0.06, volume);        // A5
	playTone(ctx, 880, now + 0.1, 0.06, volume);  // A5
}

// =============================================================================
// MULTI-AGENT SOUNDS
// =============================================================================

/**
 * Play a swarm spawn sound - multiple rising tones
 * Used when spawning multiple agents
 */
export function playSwarmSound(agentCount: number = 3): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playSwarmTones(ctx, agentCount)).catch(() => {});
		return;
	}

	playSwarmTones(ctx, agentCount);
}

function playSwarmTones(ctx: AudioContext, count: number): void {
	const now = ctx.currentTime;
	const volume = 0.10;
	const baseFreqs = [523.25, 659.25, 783.99, 880, 987.77, 1046.5]; // C5 to C6

	// Play ascending tones for each agent (capped at 6)
	const tonesCount = Math.min(count, 6);
	for (let i = 0; i < tonesCount; i++) {
		playTone(ctx, baseFreqs[i], now + (i * 0.08), 0.1, volume * (0.7 + i * 0.05));
	}
}

// =============================================================================
// UI FEEDBACK SOUNDS
// =============================================================================

/**
 * Play a copy sound - quick subtle click
 * Used when copying to clipboard
 */
export function playCopySound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playCopyTones(ctx)).catch(() => {});
		return;
	}

	playCopyTones(ctx);
}

function playCopyTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.07; // Very subtle

	// Quick subtle click
	playTone(ctx, 1200, now, 0.02, volume);  // High quick blip
}

/**
 * Play a delete sound - soft removal
 * Used when deleting items
 */
export function playDeleteSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playDeleteTones(ctx)).catch(() => {});
		return;
	}

	playDeleteTones(ctx);
}

function playDeleteTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.10;

	// Soft descending removal
	playTone(ctx, 440, now, 0.06, volume);        // A4
	playTone(ctx, 329.63, now + 0.07, 0.1, volume * 0.7); // E4
}

/**
 * Play an attachment sound - light attach
 * Used when attaching files
 */
export function playAttachmentSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playAttachmentTones(ctx)).catch(() => {});
		return;
	}

	playAttachmentTones(ctx);
}

function playAttachmentTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.09;

	// Light "attach" sound
	playTone(ctx, 698.46, now, 0.05, volume * 0.7);  // F5
	playTone(ctx, 880, now + 0.05, 0.07, volume);    // A5
}

/**
 * Play a celebration sound - triumphant fanfare
 * Used for streak celebrations and big achievements
 */
export function playCelebrationSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playCelebrationTones(ctx)).catch(() => {});
		return;
	}

	playCelebrationTones(ctx);
}

function playCelebrationTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.14;

	// Triumphant fanfare - major chord arpeggio with flourish
	playTone(ctx, 523.25, now, 0.1, volume * 0.7);        // C5
	playTone(ctx, 659.25, now + 0.08, 0.1, volume * 0.8); // E5
	playTone(ctx, 783.99, now + 0.16, 0.1, volume * 0.9); // G5
	playTone(ctx, 1046.5, now + 0.24, 0.15, volume);      // C6
	playTone(ctx, 1318.5, now + 0.36, 0.12, volume * 0.7); // E6
	playTone(ctx, 1567.98, now + 0.45, 0.2, volume * 0.5); // G6 - high sparkle
}

/**
 * Play a modal/palette open sound - quick swoop
 * Used when opening command palette or modals
 */
export function playOpenSound(): void {
	if (!areSoundsEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	if (ctx.state === 'suspended') {
		ctx.resume().then(() => playOpenTones(ctx)).catch(() => {});
		return;
	}

	playOpenTones(ctx);
}

function playOpenTones(ctx: AudioContext): void {
	const now = ctx.currentTime;
	const volume = 0.08;

	// Quick ascending swoop
	playTone(ctx, 440, now, 0.04, volume * 0.6);      // A4
	playTone(ctx, 587.33, now + 0.04, 0.05, volume);  // D5
}
