/**
 * Sound effects for the dashboard using Web Audio API
 * Generates sounds programmatically without external audio files
 */

let audioContext: AudioContext | null = null;
let soundsEnabled = false;

// Check localStorage for user preference
if (typeof window !== 'undefined') {
	soundsEnabled = localStorage.getItem('dashboard-sounds-enabled') === 'true';
}

/**
 * Check if sounds are enabled
 */
export function areSoundsEnabled(): boolean {
	return soundsEnabled;
}

/**
 * Enable sounds (call after user grants permission)
 */
export function enableSounds(): void {
	soundsEnabled = true;
	if (typeof window !== 'undefined') {
		localStorage.setItem('dashboard-sounds-enabled', 'true');
	}
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
	soundsEnabled = false;
	if (typeof window !== 'undefined') {
		localStorage.setItem('dashboard-sounds-enabled', 'false');
	}
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
	if (!soundsEnabled) return;

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
	if (!soundsEnabled) return;

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
	if (!soundsEnabled) return;

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
	if (!soundsEnabled) return;

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
	if (!soundsEnabled) return;

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
	if (!soundsEnabled) return;

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
	if (!soundsEnabled) return;

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
