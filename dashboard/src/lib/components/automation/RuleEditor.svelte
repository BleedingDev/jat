<script lang="ts">
	/**
	 * RuleEditor Component
	 *
	 * Modal dialog for creating and editing automation rules.
	 * Provides form fields for all rule properties with validation.
	 *
	 * Features:
	 * - Name and description fields
	 * - Pattern textarea with regex/string toggle
	 * - Case sensitivity toggle
	 * - Session state filter (multi-select)
	 * - Action type dropdown with payload input
	 * - Timing controls (delay, cooldown, maxTriggers)
	 * - Category and priority settings
	 * - Validation before save
	 * - Create/Edit modes
	 */

	import type {
		AutomationRule,
		AutomationPattern,
		AutomationAction,
		ActionType,
		PatternMode,
		RuleCategory,
		QuestionUIConfig,
		QuestionUIOption
	} from '$lib/types/automation';
	import { RULE_CATEGORY_META } from '$lib/config/automationConfig';
	import { fly, fade } from 'svelte/transition';

	// =============================================================================
	// PROPS
	// =============================================================================

	interface Props {
		/** Whether the modal is open */
		isOpen?: boolean;
		/** Rule to edit (null for create mode) */
		rule?: AutomationRule | null;
		/** Called when save button is clicked with valid rule */
		onSave?: (rule: AutomationRule) => void;
		/** Called when cancel/close is clicked */
		onCancel?: () => void;
		/** Custom class */
		class?: string;
	}

	let {
		isOpen = $bindable(false),
		rule = null,
		onSave = () => {},
		onCancel = () => {},
		class: className = ''
	}: Props = $props();

	// =============================================================================
	// STATE
	// =============================================================================

	// Form state - initialized from rule prop or defaults
	let formData = $state<{
		name: string;
		description: string;
		enabled: boolean;
		patterns: Array<{ pattern: string; mode: PatternMode; caseSensitive: boolean }>;
		actions: Array<{
			type: ActionType;
			payload: string;
			delay: number;
			questionUIConfig?: QuestionUIConfig;
		}>;
		sessionFilter: string[];
		cooldownSeconds: number;
		maxTriggersPerSession: number;
		category: RuleCategory;
		priority: number;
	}>({
		name: '',
		description: '',
		enabled: true,
		patterns: [{ pattern: '', mode: 'regex', caseSensitive: false }],
		actions: [{ type: 'notify_only', payload: '', delay: 0 }],
		sessionFilter: [],
		cooldownSeconds: 30,
		maxTriggersPerSession: 0,
		category: 'custom',
		priority: 50
	});

	// Validation errors
	let errors = $state<Record<string, string>>({});

	// Session state options for multi-select
	const sessionStates = [
		{ value: 'working', label: 'Working', color: 'oklch(0.75 0.15 85)' },
		{ value: 'idle', label: 'Idle', color: 'oklch(0.55 0.02 250)' },
		{ value: 'needs-input', label: 'Needs Input', color: 'oklch(0.70 0.15 310)' },
		{ value: 'ready-for-review', label: 'Ready for Review', color: 'oklch(0.70 0.15 200)' },
		{ value: 'completing', label: 'Completing', color: 'oklch(0.70 0.15 170)' },
		{ value: 'starting', label: 'Starting', color: 'oklch(0.75 0.15 200)' }
	];

	// Action type options
	const actionTypes: Array<{ value: ActionType; label: string; description: string; icon: string }> = [
		{
			value: 'send_text',
			label: 'Send Text',
			description: 'Send text input to the session (like typing)',
			icon: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5'
		},
		{
			value: 'send_keys',
			label: 'Send Keys',
			description: 'Send special keys (Enter, Escape, Tab, etc.)',
			icon: 'M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z'
		},
		{
			value: 'tmux_command',
			label: 'Tmux Command',
			description: 'Run an arbitrary tmux command',
			icon: 'M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z'
		},
		{
			value: 'signal',
			label: 'Emit Signal',
			description: 'Emit a jat-signal event',
			icon: 'M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'
		},
		{
			value: 'notify_only',
			label: 'Notify Only',
			description: 'Show a toast notification without taking action',
			icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0'
		},
		{
			value: 'show_question_ui',
			label: 'Show Question UI',
			description: 'Show custom question UI with options (instead of auto-responding)',
			icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z'
		}
	];

	// Question type options for show_question_ui
	const questionTypes: Array<{ value: 'choice' | 'confirm' | 'input'; label: string; description: string }> = [
		{ value: 'choice', label: 'Choice', description: 'Select from multiple options' },
		{ value: 'confirm', label: 'Confirm', description: 'Yes/No confirmation' },
		{ value: 'input', label: 'Input', description: 'Free text input' }
	];

	// Special keys for send_keys action
	const specialKeys = ['Enter', 'Escape', 'Tab', 'Up', 'Down', 'Left', 'Right', 'C-c', 'C-d', 'C-u'];

	// =============================================================================
	// COMPUTED
	// =============================================================================

	const isEditMode = $derived(rule !== null);
	const modalTitle = $derived(isEditMode ? 'Edit Automation Rule' : 'Create Automation Rule');

	// =============================================================================
	// EFFECTS
	// =============================================================================

	// Initialize form when rule prop changes
	$effect(() => {
		if (rule) {
			formData = {
				name: rule.name,
				description: rule.description || '',
				enabled: rule.enabled,
				patterns: rule.patterns.map(p => ({
					pattern: p.pattern,
					mode: p.mode,
					caseSensitive: p.caseSensitive ?? false
				})),
				actions: rule.actions.map(a => ({
					type: a.type,
					payload: a.payload,
					delay: a.delay ?? 0,
					questionUIConfig: a.questionUIConfig ? { ...a.questionUIConfig } : undefined
				})),
				sessionFilter: rule.sessionFilter || [],
				cooldownSeconds: rule.cooldownSeconds,
				maxTriggersPerSession: rule.maxTriggersPerSession,
				category: rule.category || 'custom',
				priority: rule.priority
			};
		} else {
			// Reset to defaults for create mode
			formData = {
				name: '',
				description: '',
				enabled: true,
				patterns: [{ pattern: '', mode: 'regex', caseSensitive: false }],
				actions: [{ type: 'notify_only', payload: '', delay: 0 }],
				sessionFilter: [],
				cooldownSeconds: 30,
				maxTriggersPerSession: 0,
				category: 'custom',
				priority: 50
			};
		}
		errors = {};
	});

	// =============================================================================
	// HANDLERS
	// =============================================================================

	function validate(): boolean {
		const newErrors: Record<string, string> = {};

		// Name is required
		if (!formData.name.trim()) {
			newErrors.name = 'Name is required';
		}

		// At least one pattern is required
		if (formData.patterns.length === 0 || !formData.patterns.some(p => p.pattern.trim())) {
			newErrors.patterns = 'At least one pattern is required';
		}

		// Validate regex patterns
		for (let i = 0; i < formData.patterns.length; i++) {
			const p = formData.patterns[i];
			if (p.mode === 'regex' && p.pattern.trim()) {
				try {
					new RegExp(p.pattern);
				} catch {
					newErrors[`pattern-${i}`] = 'Invalid regex pattern';
				}
			}
		}

		// At least one action is required
		if (formData.actions.length === 0) {
			newErrors.actions = 'At least one action is required';
		}

		// Validate show_question_ui actions have required fields
		for (let i = 0; i < formData.actions.length; i++) {
			const action = formData.actions[i];
			if (action.type === 'show_question_ui') {
				if (!action.questionUIConfig?.question?.trim()) {
					newErrors[`action-${i}-question`] = 'Question text is required';
				}
				if (action.questionUIConfig?.questionType === 'choice') {
					const options = action.questionUIConfig.options || [];
					if (options.length < 2) {
						newErrors[`action-${i}-options`] = 'At least 2 options are required for choice type';
					}
					for (let j = 0; j < options.length; j++) {
						if (!options[j].label?.trim()) {
							newErrors[`action-${i}-option-${j}-label`] = 'Option label is required';
						}
						if (!options[j].value?.trim()) {
							newErrors[`action-${i}-option-${j}-value`] = 'Option value is required';
						}
					}
				}
			}
		}

		// Cooldown must be non-negative
		if (formData.cooldownSeconds < 0) {
			newErrors.cooldown = 'Cooldown must be non-negative';
		}

		// Max triggers must be non-negative
		if (formData.maxTriggersPerSession < 0) {
			newErrors.maxTriggers = 'Max triggers must be non-negative';
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	function handleSave() {
		if (!validate()) return;

		const ruleData: AutomationRule = {
			id: rule?.id || `rule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
			name: formData.name.trim(),
			description: formData.description.trim() || undefined,
			enabled: formData.enabled,
			patterns: formData.patterns
				.filter(p => p.pattern.trim())
				.map(p => ({
					pattern: p.pattern,
					mode: p.mode,
					caseSensitive: p.caseSensitive
				})),
			actions: formData.actions.map(a => ({
				type: a.type,
				payload: a.payload,
				delay: a.delay > 0 ? a.delay : undefined,
				questionUIConfig: a.type === 'show_question_ui' ? a.questionUIConfig : undefined
			})),
			sessionFilter: formData.sessionFilter.length > 0 ? formData.sessionFilter : undefined,
			cooldownSeconds: formData.cooldownSeconds,
			maxTriggersPerSession: formData.maxTriggersPerSession,
			category: formData.category,
			priority: formData.priority,
			isPreset: rule?.isPreset,
			presetId: rule?.presetId
		};

		onSave(ruleData);
		isOpen = false;
	}

	function handleCancel() {
		onCancel();
		isOpen = false;
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleCancel();
		}
	}

	// Pattern management
	function addPattern() {
		formData.patterns = [...formData.patterns, { pattern: '', mode: 'regex', caseSensitive: false }];
	}

	function removePattern(index: number) {
		if (formData.patterns.length > 1) {
			formData.patterns = formData.patterns.filter((_, i) => i !== index);
		}
	}

	// Action management
	function addAction() {
		formData.actions = [...formData.actions, { type: 'notify_only', payload: '', delay: 0 }];
	}

	function removeAction(index: number) {
		if (formData.actions.length > 1) {
			formData.actions = formData.actions.filter((_, i) => i !== index);
		}
	}

	// Question UI config management
	function initQuestionUIConfig(actionIndex: number) {
		if (!formData.actions[actionIndex].questionUIConfig) {
			formData.actions[actionIndex].questionUIConfig = {
				question: '',
				questionType: 'choice',
				options: [
					{ label: 'Option 1', value: '1', description: '' },
					{ label: 'Option 2', value: '2', description: '' }
				],
				timeout: undefined
			};
		}
	}

	function addQuestionOption(actionIndex: number) {
		const config = formData.actions[actionIndex].questionUIConfig;
		if (config && config.options) {
			const nextNum = config.options.length + 1;
			config.options = [...config.options, { label: `Option ${nextNum}`, value: String(nextNum), description: '' }];
		}
	}

	function removeQuestionOption(actionIndex: number, optionIndex: number) {
		const config = formData.actions[actionIndex].questionUIConfig;
		if (config && config.options && config.options.length > 1) {
			config.options = config.options.filter((_, i) => i !== optionIndex);
		}
	}

	// Handle action type change - initialize questionUIConfig when switching to show_question_ui
	function handleActionTypeChange(actionIndex: number, newType: ActionType) {
		formData.actions[actionIndex].type = newType;
		if (newType === 'show_question_ui') {
			initQuestionUIConfig(actionIndex);
		}
	}

	// State filter toggle
	function toggleStateFilter(state: string) {
		if (formData.sessionFilter.includes(state)) {
			formData.sessionFilter = formData.sessionFilter.filter(s => s !== state);
		} else {
			formData.sessionFilter = [...formData.sessionFilter, state];
		}
	}
</script>

{#if isOpen}
	<!-- Modal Overlay -->
	<div
		class="modal-overlay {className}"
		onclick={handleOverlayClick}
		onkeydown={(e) => e.key === 'Escape' && handleCancel()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="rule-editor-title"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
	>
		<!-- Modal Content -->
		<div
			class="modal-content"
			transition:fly={{ y: 20, duration: 200 }}
		>
			<!-- Header -->
			<header class="modal-header">
				<div class="header-title">
					<svg
						class="header-icon"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d={RULE_CATEGORY_META[formData.category].icon} />
					</svg>
					<h2 id="rule-editor-title">{modalTitle}</h2>
				</div>
				<button
					class="close-btn"
					onclick={handleCancel}
					aria-label="Close dialog"
				>
					<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</header>

			<!-- Form Content -->
			<div class="modal-body">
				<!-- Basic Info Section -->
				<section class="form-section">
					<h3 class="section-title">Basic Information</h3>

					<!-- Name -->
					<div class="form-group">
						<label for="rule-name" class="form-label">
							Name <span class="required">*</span>
						</label>
						<input
							id="rule-name"
							type="text"
							bind:value={formData.name}
							class="form-input"
							class:error={errors.name}
							placeholder="e.g., API Error Recovery"
						/>
						{#if errors.name}
							<span class="error-text">{errors.name}</span>
						{/if}
					</div>

					<!-- Description -->
					<div class="form-group">
						<label for="rule-description" class="form-label">Description</label>
						<textarea
							id="rule-description"
							bind:value={formData.description}
							class="form-textarea"
							placeholder="Describe what this rule does..."
							rows="2"
						></textarea>
					</div>

					<!-- Category & Priority -->
					<div class="form-row">
						<div class="form-group flex-1">
							<label for="rule-category" class="form-label">Category</label>
							<select id="rule-category" bind:value={formData.category} class="form-select">
								{#each Object.entries(RULE_CATEGORY_META) as [value, meta]}
									<option {value}>{meta.label}</option>
								{/each}
							</select>
						</div>
						<div class="form-group flex-1">
							<label for="rule-priority" class="form-label">Priority</label>
							<input
								id="rule-priority"
								type="number"
								bind:value={formData.priority}
								class="form-input"
								min="0"
								max="100"
							/>
							<span class="help-text">Higher = processed first</span>
						</div>
						<div class="form-group">
							<label class="form-label">Enabled</label>
							<label class="toggle-label">
								<input
									type="checkbox"
									bind:checked={formData.enabled}
									class="toggle-input"
								/>
								<span class="toggle-switch"></span>
							</label>
						</div>
					</div>
				</section>

				<!-- Patterns Section -->
				<section class="form-section">
					<div class="section-header">
						<h3 class="section-title">Patterns</h3>
						<button class="add-btn" onclick={addPattern}>
							<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
							</svg>
							Add Pattern
						</button>
					</div>
					{#if errors.patterns}
						<span class="error-text">{errors.patterns}</span>
					{/if}

					{#each formData.patterns as pattern, index}
						<div class="pattern-item">
							<div class="pattern-header">
								<span class="pattern-number">Pattern {index + 1}</span>
								{#if formData.patterns.length > 1}
									<button
										class="remove-btn"
										onclick={() => removePattern(index)}
										aria-label="Remove pattern"
									>
										<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								{/if}
							</div>
							<textarea
								bind:value={pattern.pattern}
								class="form-textarea pattern-input"
								class:error={errors[`pattern-${index}`]}
								placeholder="Enter pattern to match..."
								rows="2"
							></textarea>
							{#if errors[`pattern-${index}`]}
								<span class="error-text">{errors[`pattern-${index}`]}</span>
							{/if}
							<div class="pattern-options">
								<label class="checkbox-label">
									<input
										type="checkbox"
										checked={pattern.mode === 'regex'}
										onchange={() => pattern.mode = pattern.mode === 'regex' ? 'string' : 'regex'}
									/>
									<span>Regex</span>
								</label>
								<label class="checkbox-label">
									<input type="checkbox" bind:checked={pattern.caseSensitive} />
									<span>Case Sensitive</span>
								</label>
							</div>
						</div>
					{/each}
				</section>

				<!-- Session State Filter Section -->
				<section class="form-section">
					<h3 class="section-title">Session State Filter</h3>
					<p class="section-description">Only trigger when session is in selected states (leave empty for all states)</p>

					<div class="state-filter-grid">
						{#each sessionStates as state}
							<button
								class="state-chip"
								class:selected={formData.sessionFilter.includes(state.value)}
								style="--chip-color: {state.color}"
								onclick={() => toggleStateFilter(state.value)}
							>
								{state.label}
							</button>
						{/each}
					</div>
				</section>

				<!-- Actions Section -->
				<section class="form-section">
					<div class="section-header">
						<h3 class="section-title">Actions</h3>
						<button class="add-btn" onclick={addAction}>
							<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
							</svg>
							Add Action
						</button>
					</div>
					{#if errors.actions}
						<span class="error-text">{errors.actions}</span>
					{/if}

					{#each formData.actions as action, index}
						<div class="action-item">
							<div class="action-header">
								<span class="action-number">Action {index + 1}</span>
								{#if formData.actions.length > 1}
									<button
										class="remove-btn"
										onclick={() => removeAction(index)}
										aria-label="Remove action"
									>
										<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								{/if}
							</div>

							<div class="form-row">
								<div class="form-group flex-1">
									<label class="form-label">Action Type</label>
									<select
										value={action.type}
										onchange={(e) => handleActionTypeChange(index, e.currentTarget.value as ActionType)}
										class="form-select"
									>
										{#each actionTypes as actionType}
											<option value={actionType.value}>{actionType.label}</option>
										{/each}
									</select>
									<span class="help-text">
										{actionTypes.find(a => a.value === action.type)?.description}
									</span>
								</div>
								<div class="form-group w-28">
									<label class="form-label">Delay (ms)</label>
									<input
										type="number"
										bind:value={action.delay}
										class="form-input"
										min="0"
										step="100"
										placeholder="0"
									/>
								</div>
							</div>

							<!-- Show Question UI Configuration -->
							{#if action.type === 'show_question_ui' && action.questionUIConfig}
								<div class="question-ui-config">
									<div class="form-group">
										<label class="form-label">Question Text <span class="required">*</span></label>
										<input
											type="text"
											bind:value={action.questionUIConfig.question}
											class="form-input"
											class:error={errors[`action-${index}-question`]}
											placeholder="e.g., Which approach should we use?"
										/>
										{#if errors[`action-${index}-question`]}
											<span class="error-text">{errors[`action-${index}-question`]}</span>
										{/if}
									</div>

									<div class="form-row">
										<div class="form-group flex-1">
											<label class="form-label">Question Type</label>
											<select bind:value={action.questionUIConfig.questionType} class="form-select">
												{#each questionTypes as qType}
													<option value={qType.value}>{qType.label}</option>
												{/each}
											</select>
											<span class="help-text">
												{questionTypes.find(q => q.value === action.questionUIConfig?.questionType)?.description}
											</span>
										</div>
										<div class="form-group w-28">
											<label class="form-label">Timeout (s)</label>
											<input
												type="number"
												bind:value={action.questionUIConfig.timeout}
												class="form-input"
												min="0"
												step="10"
												placeholder="None"
											/>
										</div>
									</div>

									<!-- Options (for choice type) -->
									{#if action.questionUIConfig.questionType === 'choice'}
										<div class="options-section">
											<div class="options-header">
												<span class="options-title">Options</span>
												<button class="add-btn" onclick={() => addQuestionOption(index)}>
													<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
														<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
													</svg>
													Add Option
												</button>
											</div>
											{#if errors[`action-${index}-options`]}
												<span class="error-text">{errors[`action-${index}-options`]}</span>
											{/if}

											{#each action.questionUIConfig.options || [] as option, optIndex}
												<div class="option-item">
													<div class="option-header">
														<span class="option-number">Option {optIndex + 1}</span>
														{#if (action.questionUIConfig.options?.length || 0) > 1}
															<button
																class="remove-btn"
																onclick={() => removeQuestionOption(index, optIndex)}
																aria-label="Remove option"
															>
																<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
																	<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
																</svg>
															</button>
														{/if}
													</div>
													<div class="form-row">
														<div class="form-group flex-1">
															<label class="form-label">Label <span class="required">*</span></label>
															<input
																type="text"
																bind:value={option.label}
																class="form-input"
																class:error={errors[`action-${index}-option-${optIndex}-label`]}
																placeholder="Display text"
															/>
															{#if errors[`action-${index}-option-${optIndex}-label`]}
																<span class="error-text">{errors[`action-${index}-option-${optIndex}-label`]}</span>
															{/if}
														</div>
														<div class="form-group w-24">
															<label class="form-label">Value <span class="required">*</span></label>
															<input
																type="text"
																bind:value={option.value}
																class="form-input"
																class:error={errors[`action-${index}-option-${optIndex}-value`]}
																placeholder="1"
															/>
															{#if errors[`action-${index}-option-${optIndex}-value`]}
																<span class="error-text">{errors[`action-${index}-option-${optIndex}-value`]}</span>
															{/if}
														</div>
													</div>
													<div class="form-group">
														<label class="form-label">Description (optional)</label>
														<input
															type="text"
															bind:value={option.description}
															class="form-input"
															placeholder="Optional description"
														/>
													</div>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{:else}
								<!-- Standard payload input for other action types -->
								<div class="form-group">
									<label class="form-label">
										{#if action.type === 'send_keys'}
											Key to Send
										{:else if action.type === 'notify_only'}
											Notification Message
										{:else if action.type === 'signal'}
											Signal Type/Data
										{:else if action.type === 'tmux_command'}
											Tmux Command
										{:else}
											Text to Send
										{/if}
									</label>
									{#if action.type === 'send_keys'}
										<select bind:value={action.payload} class="form-select">
											{#each specialKeys as key}
												<option value={key}>{key}</option>
											{/each}
										</select>
									{:else}
										<input
											type="text"
											bind:value={action.payload}
											class="form-input"
											placeholder={action.type === 'notify_only' ? 'Notification message...' :
												action.type === 'signal' ? 'working {"taskId":"..."}' :
												action.type === 'tmux_command' ? 'send-keys -t {session} "text"' :
												'Text to send...'}
										/>
									{/if}
								<!-- Signal Help Section -->
								{#if action.type === 'signal'}
									<details class="signal-help">
										<summary class="signal-help-toggle">
											<svg class="help-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
											</svg>
											Signal Types, Variables & Payloads
										</summary>
										<div class="signal-help-content">
											<p class="signal-help-intro">
												Format: <code>type payload</code> (type followed by space, then JSON)
											</p>

											<!-- Template Variables Section -->
											<div class="signal-vars-section">
												<div class="signal-vars-title">Template Variables</div>
												<div class="signal-vars-grid">
													<code class="signal-var">{'{session}'}</code>
													<span class="signal-var-desc">Tmux session name (e.g., "jat-FairBay")</span>

													<code class="signal-var">{'{agent}'}</code>
													<span class="signal-var-desc">Agent name (e.g., "FairBay")</span>

													<code class="signal-var">{'{timestamp}'}</code>
													<span class="signal-var-desc">ISO timestamp when rule triggered</span>

													<code class="signal-var">{'{match}'}</code>
													<span class="signal-var-desc">Full text matched by pattern</span>

													<code class="signal-var">{'{$0}'}</code>
													<span class="signal-var-desc">Same as {'{match}'} (full match)</span>

													<code class="signal-var">{'{$1}'}, {'{$2}'}, ...</code>
													<span class="signal-var-desc">Regex capture groups</span>
												</div>
											</div>

											<!-- Example with Variables -->
											<div class="signal-vars-example">
												<div class="signal-vars-title">Example: Extract task ID from output</div>
												<div class="signal-vars-example-content">
													<div class="signal-vars-example-row">
														<span class="signal-vars-example-label">Pattern (regex):</span>
														<code class="signal-vars-example-code">Working on task (jat-[a-z0-9]+)</code>
													</div>
													<div class="signal-vars-example-row">
														<span class="signal-vars-example-label">Signal payload:</span>
														<code class="signal-vars-example-code">{`working {"taskId":"{$1}","agentName":"{agent}"}`}</code>
													</div>
													<div class="signal-vars-example-row">
														<span class="signal-vars-example-label">Result:</span>
														<code class="signal-vars-example-code">{`working {"taskId":"jat-abc","agentName":"FairBay"}`}</code>
													</div>
												</div>
											</div>

											<div class="signal-types-title">Signal Types</div>
											<div class="signal-examples">
												<div class="signal-example">
													<span class="signal-type">working</span>
													<code class="signal-payload">{`{"taskId":"{$1}","taskTitle":"..."}`}</code>
												</div>
												<div class="signal-example">
													<span class="signal-type">idle</span>
													<code class="signal-payload">{`{"readyForWork":true}`}</code>
												</div>
												<div class="signal-example">
													<span class="signal-type">needs_input</span>
													<code class="signal-payload">{`{"taskId":"...","question":"...","questionType":"choice"}`}</code>
												</div>
												<div class="signal-example">
													<span class="signal-type">review</span>
													<code class="signal-payload">{`{"taskId":"...","summary":["..."]}`}</code>
												</div>
												<div class="signal-example">
													<span class="signal-type">completing</span>
													<code class="signal-payload">{`{"taskId":"...","currentStep":"..."}`}</code>
												</div>
												<div class="signal-example">
													<span class="signal-type">completed</span>
													<code class="signal-payload">{`{"taskId":"...","outcome":"success"}`}</code>
												</div>
												<div class="signal-example">
													<span class="signal-type">starting</span>
													<code class="signal-payload">{`{"agentName":"{agent}","project":"jat"}`}</code>
												</div>
												<div class="signal-example">
													<span class="signal-type">compacting</span>
													<code class="signal-payload">{`{"reason":"...","contextSizeBefore":...}`}</code>
												</div>
											</div>
										</div>
									</details>
								{/if}
							</div>
							{/if}
						</div>
					{/each}
				</section>

				<!-- Timing Section -->
				<section class="form-section">
					<h3 class="section-title">Timing & Limits</h3>

					<div class="form-row">
						<div class="form-group flex-1">
							<label for="cooldown" class="form-label">Cooldown (seconds)</label>
							<input
								id="cooldown"
								type="number"
								bind:value={formData.cooldownSeconds}
								class="form-input"
								class:error={errors.cooldown}
								min="0"
								step="5"
							/>
							{#if errors.cooldown}
								<span class="error-text">{errors.cooldown}</span>
							{/if}
							<span class="help-text">Minimum time between triggers</span>
						</div>
						<div class="form-group flex-1">
							<label for="max-triggers" class="form-label">Max Triggers per Session</label>
							<input
								id="max-triggers"
								type="number"
								bind:value={formData.maxTriggersPerSession}
								class="form-input"
								class:error={errors.maxTriggers}
								min="0"
							/>
							{#if errors.maxTriggers}
								<span class="error-text">{errors.maxTriggers}</span>
							{/if}
							<span class="help-text">0 = unlimited</span>
						</div>
					</div>
				</section>
			</div>

			<!-- Footer -->
			<footer class="modal-footer">
				<button class="btn-cancel" onclick={handleCancel}>
					Cancel
				</button>
				<button class="btn-save" onclick={handleSave}>
					{isEditMode ? 'Save Changes' : 'Create Rule'}
				</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	/* Modal Overlay */
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		background: oklch(0.10 0.02 250 / 0.85);
		backdrop-filter: blur(4px);
		padding: 1rem;
	}

	/* Modal Content */
	.modal-content {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 700px;
		max-height: calc(100vh - 2rem);
		background: oklch(0.16 0.02 250);
		border: 1px solid oklch(0.28 0.02 250);
		border-radius: 12px;
		box-shadow: 0 25px 50px -12px oklch(0 0 0 / 0.5);
		overflow: hidden;
	}

	/* Header */
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		background: oklch(0.14 0.02 250);
		border-bottom: 1px solid oklch(0.25 0.02 250);
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.header-title h2 {
		font-size: 1rem;
		font-weight: 600;
		color: oklch(0.90 0.02 250);
		margin: 0;
		font-family: ui-monospace, monospace;
	}

	.header-icon {
		width: 22px;
		height: 22px;
		color: oklch(0.70 0.10 200);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: oklch(0.55 0.02 250);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.close-btn:hover {
		background: oklch(0.25 0.02 250);
		color: oklch(0.80 0.02 250);
	}

	.close-btn svg {
		width: 18px;
		height: 18px;
	}

	/* Body */
	.modal-body {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* Sections */
	.form-section {
		padding: 1rem;
		background: oklch(0.18 0.02 250);
		border: 1px solid oklch(0.25 0.02 250);
		border-radius: 10px;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.section-title {
		font-size: 0.8rem;
		font-weight: 600;
		color: oklch(0.75 0.08 200);
		margin: 0 0 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-family: ui-monospace, monospace;
	}

	.section-header .section-title {
		margin-bottom: 0;
	}

	.section-description {
		font-size: 0.75rem;
		color: oklch(0.55 0.02 250);
		margin: 0 0 0.75rem;
	}

	/* Form Elements */
	.form-group {
		margin-bottom: 0.875rem;
	}

	.form-group:last-child {
		margin-bottom: 0;
	}

	.form-row {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}

	.flex-1 {
		flex: 1;
	}

	.w-28 {
		width: 7rem;
	}

	.form-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 500;
		color: oklch(0.70 0.02 250);
		margin-bottom: 0.375rem;
		font-family: ui-monospace, monospace;
	}

	.required {
		color: oklch(0.70 0.18 25);
	}

	.form-input,
	.form-select,
	.form-textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		font-size: 0.8rem;
		font-family: ui-monospace, monospace;
		background: oklch(0.12 0.02 250);
		border: 1px solid oklch(0.28 0.02 250);
		border-radius: 6px;
		color: oklch(0.90 0.02 250);
		transition: all 0.15s ease;
	}

	.form-input:focus,
	.form-select:focus,
	.form-textarea:focus {
		outline: none;
		border-color: oklch(0.55 0.12 200);
		box-shadow: 0 0 0 2px oklch(0.55 0.12 200 / 0.2);
	}

	.form-input.error,
	.form-textarea.error {
		border-color: oklch(0.55 0.18 25);
	}

	.form-textarea {
		resize: vertical;
		min-height: 60px;
	}

	.form-select {
		cursor: pointer;
	}

	.help-text {
		display: block;
		font-size: 0.65rem;
		color: oklch(0.50 0.02 250);
		margin-top: 0.25rem;
		font-family: ui-monospace, monospace;
	}

	.error-text {
		display: block;
		font-size: 0.7rem;
		color: oklch(0.70 0.18 25);
		margin-top: 0.25rem;
		font-family: ui-monospace, monospace;
	}

	/* Toggle Switch */
	.toggle-label {
		display: inline-flex;
		align-items: center;
		cursor: pointer;
		margin-top: 0.25rem;
	}

	.toggle-input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.toggle-switch {
		position: relative;
		width: 44px;
		height: 24px;
		background: oklch(0.30 0.02 250);
		border-radius: 12px;
		transition: all 0.2s ease;
	}

	.toggle-switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		background: oklch(0.70 0.02 250);
		border-radius: 50%;
		transition: all 0.2s ease;
	}

	.toggle-input:checked + .toggle-switch {
		background: oklch(0.55 0.15 145);
	}

	.toggle-input:checked + .toggle-switch::after {
		left: 22px;
		background: oklch(0.95 0.02 250);
	}

	/* Checkbox */
	.checkbox-label {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		cursor: pointer;
		font-size: 0.75rem;
		color: oklch(0.70 0.02 250);
		font-family: ui-monospace, monospace;
	}

	.checkbox-label input[type="checkbox"] {
		width: 16px;
		height: 16px;
		accent-color: oklch(0.55 0.15 200);
		cursor: pointer;
	}

	/* Add/Remove Buttons */
	.add-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.7rem;
		font-family: ui-monospace, monospace;
		background: oklch(0.25 0.08 200 / 0.3);
		border: 1px solid oklch(0.45 0.12 200 / 0.5);
		border-radius: 6px;
		color: oklch(0.80 0.10 200);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.add-btn:hover {
		background: oklch(0.30 0.10 200 / 0.4);
		border-color: oklch(0.55 0.12 200);
	}

	.add-btn svg {
		width: 14px;
		height: 14px;
	}

	.remove-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: oklch(0.55 0.02 250);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.remove-btn:hover {
		background: oklch(0.30 0.10 25);
		color: oklch(0.70 0.18 25);
	}

	.remove-btn svg {
		width: 14px;
		height: 14px;
	}

	/* Pattern Item */
	.pattern-item,
	.action-item {
		padding: 0.875rem;
		background: oklch(0.14 0.02 250);
		border: 1px solid oklch(0.25 0.02 250);
		border-radius: 8px;
		margin-bottom: 0.75rem;
	}

	.pattern-item:last-child,
	.action-item:last-child {
		margin-bottom: 0;
	}

	.pattern-header,
	.action-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.pattern-number,
	.action-number {
		font-size: 0.7rem;
		font-weight: 600;
		color: oklch(0.60 0.02 250);
		font-family: ui-monospace, monospace;
	}

	.pattern-input {
		font-family: ui-monospace, monospace;
	}

	.pattern-options {
		display: flex;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	/* State Filter Grid */
	.state-filter-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.state-chip {
		padding: 0.375rem 0.75rem;
		font-size: 0.7rem;
		font-family: ui-monospace, monospace;
		background: oklch(0.20 0.02 250);
		border: 1px solid oklch(0.30 0.02 250);
		border-radius: 16px;
		color: oklch(0.65 0.02 250);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.state-chip:hover {
		background: oklch(0.25 0.02 250);
		border-color: oklch(0.40 0.02 250);
	}

	.state-chip.selected {
		background: color-mix(in oklch, var(--chip-color) 20%, transparent);
		border-color: var(--chip-color);
		color: var(--chip-color);
	}

	/* Footer */
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		background: oklch(0.14 0.02 250);
		border-top: 1px solid oklch(0.25 0.02 250);
	}

	.btn-cancel,
	.btn-save {
		padding: 0.5rem 1.25rem;
		font-size: 0.8rem;
		font-family: ui-monospace, monospace;
		font-weight: 500;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-cancel {
		background: transparent;
		border: 1px solid oklch(0.35 0.02 250);
		color: oklch(0.70 0.02 250);
	}

	.btn-cancel:hover {
		background: oklch(0.22 0.02 250);
		border-color: oklch(0.45 0.02 250);
	}

	.btn-save {
		background: oklch(0.45 0.15 145);
		border: 1px solid oklch(0.55 0.18 145);
		color: oklch(0.98 0.02 250);
	}

	.btn-save:hover {
		background: oklch(0.50 0.18 145);
	}

	/* Signal Help Section */
	.signal-help {
		margin-top: 0.5rem;
	}

	.signal-help-toggle {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.7rem;
		color: oklch(0.60 0.08 200);
		cursor: pointer;
		user-select: none;
		font-family: ui-monospace, monospace;
	}

	.signal-help-toggle:hover {
		color: oklch(0.75 0.12 200);
	}

	.help-icon {
		width: 14px;
		height: 14px;
	}

	.signal-help[open] .signal-help-toggle {
		color: oklch(0.75 0.12 200);
		margin-bottom: 0.5rem;
	}

	.signal-help-content {
		padding: 0.75rem;
		background: oklch(0.14 0.02 250);
		border: 1px solid oklch(0.28 0.02 250);
		border-radius: 8px;
		font-size: 0.7rem;
	}

	.signal-help-intro {
		color: oklch(0.75 0.02 250);
		margin: 0 0 0.75rem;
		font-family: ui-monospace, monospace;
	}

	.signal-help-intro code {
		background: oklch(0.20 0.04 200);
		color: oklch(0.85 0.10 200);
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		font-size: 0.65rem;
	}

	.signal-examples {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin-bottom: 0.75rem;
	}

	.signal-example {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.25rem 0;
	}

	.signal-type {
		flex-shrink: 0;
		width: 80px;
		font-weight: 600;
		color: oklch(0.75 0.15 145);
		font-family: ui-monospace, monospace;
		font-size: 0.65rem;
	}

	.signal-payload {
		flex: 1;
		background: oklch(0.18 0.02 250);
		color: oklch(0.70 0.02 250);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.6rem;
		font-family: ui-monospace, monospace;
		word-break: break-all;
		border: 1px solid oklch(0.25 0.02 250);
	}

	/* Template Variables Section */
	.signal-vars-section {
		margin-bottom: 0.75rem;
		padding: 0.5rem;
		background: oklch(0.16 0.02 250);
		border: 1px solid oklch(0.25 0.02 250);
		border-radius: 6px;
	}

	.signal-vars-title,
	.signal-types-title {
		font-size: 0.65rem;
		font-weight: 600;
		color: oklch(0.70 0.10 200);
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-family: ui-monospace, monospace;
	}

	.signal-types-title {
		margin-top: 0.5rem;
	}

	.signal-vars-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 0.75rem;
		align-items: baseline;
	}

	.signal-var {
		background: oklch(0.25 0.10 145 / 0.3);
		color: oklch(0.85 0.12 145);
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		font-size: 0.6rem;
		font-family: ui-monospace, monospace;
		white-space: nowrap;
	}

	.signal-var-desc {
		font-size: 0.6rem;
		color: oklch(0.65 0.02 250);
		font-family: ui-monospace, monospace;
	}

	/* Example with Variables */
	.signal-vars-example {
		margin-bottom: 0.75rem;
		padding: 0.5rem;
		background: oklch(0.18 0.04 200 / 0.2);
		border: 1px solid oklch(0.35 0.08 200 / 0.3);
		border-radius: 6px;
	}

	.signal-vars-example-content {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.signal-vars-example-row {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.signal-vars-example-label {
		font-size: 0.55rem;
		color: oklch(0.60 0.02 250);
		font-family: ui-monospace, monospace;
		text-transform: uppercase;
	}

	.signal-vars-example-code {
		background: oklch(0.14 0.02 250);
		color: oklch(0.80 0.02 250);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.6rem;
		font-family: ui-monospace, monospace;
		word-break: break-all;
		border: 1px solid oklch(0.25 0.02 250);
	}

	/* Responsive */
	@media (max-width: 640px) {
		.modal-content {
			max-height: calc(100vh - 1rem);
		}

		.form-row {
			flex-direction: column;
			gap: 0.875rem;
		}

		.w-28 {
			width: 100%;
		}

		.signal-example {
			flex-direction: column;
			gap: 0.25rem;
		}

		.signal-type {
			width: auto;
		}

		.w-24 {
			width: 100%;
		}
	}

	/* Question UI Config */
	.question-ui-config {
		margin-top: 0.75rem;
		padding: 0.75rem;
		background: oklch(0.16 0.04 310 / 0.15);
		border: 1px solid oklch(0.45 0.12 310 / 0.3);
		border-radius: 8px;
	}

	.options-section {
		margin-top: 0.75rem;
	}

	.options-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.options-title {
		font-size: 0.7rem;
		font-weight: 600;
		color: oklch(0.70 0.10 310);
		font-family: ui-monospace, monospace;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.option-item {
		padding: 0.625rem;
		background: oklch(0.14 0.02 250);
		border: 1px solid oklch(0.25 0.02 250);
		border-radius: 6px;
		margin-bottom: 0.5rem;
	}

	.option-item:last-child {
		margin-bottom: 0;
	}

	.option-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.375rem;
	}

	.option-number {
		font-size: 0.65rem;
		font-weight: 600;
		color: oklch(0.60 0.08 310);
		font-family: ui-monospace, monospace;
	}

	.w-24 {
		width: 6rem;
	}
</style>
