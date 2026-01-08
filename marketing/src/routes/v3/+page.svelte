<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
	import HeroV2 from '$lib/components/HeroV2.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let copied = $state(false);
	const installCommand = 'curl -fsSL https://raw.githubusercontent.com/joewinke/jat/main/tools/scripts/bootstrap.sh | bash';

	async function copyCommand() {
		await navigator.clipboard.writeText(installCommand);
		copied = true;
		setTimeout(() => { copied = false; }, 2000);
	}

	// Workflow steps - simplified from original
	const workflowSteps = [
		{ num: '1', title: 'PLAN WITH AI', desc: 'Describe your feature, get a PRD' },
		{ num: '2', title: '/JAT:BEAD', desc: 'Convert PRD to structured tasks' },
		{ num: '3', title: 'EPIC SWARM', desc: 'Spawn agents on subtasks' },
		{ num: '4', title: 'PARALLEL WORK', desc: 'Watch agents code simultaneously' },
		{ num: '5', title: 'SMART QUESTIONS', desc: '"OAuth or JWT?" click button' },
		{ num: '6', title: 'REVIEW IN /files', desc: 'See diffs, check code' },
		{ num: '7', title: 'COMMIT & PUSH', desc: 'Stage, message, push' },
		{ num: '8', title: 'AUTO-PROCEED', desc: 'Low-priority tasks complete auto' },
		{ num: '9', title: 'SUGGESTED TASKS', desc: 'Agent proposes next work loop' }
	];

	// Features - JAT-themed
	const features = [
		{ icon: 'swarm', title: 'Multi-Agent (40+)', desc: 'Run dozens of agents simultaneously across your codebase' },
		{ icon: 'tasks', title: 'Built-in Tasks', desc: 'Beads-powered task management with dependencies' },
		{ icon: 'epic', title: 'Epic Swarm', desc: 'Spawn parallel agents on epic subtasks' },
		{ icon: 'question', title: 'Smart Questions', desc: 'Agent questions become clickable buttons' },
		{ icon: 'auto', title: 'Auto-Proceed', desc: 'Configure rules for automatic completion' },
		{ icon: 'local', title: '100% Local', desc: 'Your code never leaves your machine' }
	];

	// Comparison data
	const comparison = [
		{ feature: 'Multi-agent (20+)', jat: true, cursor: false, windsurf: false, cline: false },
		{ feature: 'Visual dashboard', jat: true, cursor: false, windsurf: false, cline: false },
		{ feature: 'Task management', jat: true, cursor: false, windsurf: false, cline: false },
		{ feature: 'Epic Swarm (parallel)', jat: true, cursor: false, windsurf: false, cline: false },
		{ feature: 'Agent coordination', jat: true, cursor: false, windsurf: false, cline: false },
		{ feature: 'Code editor', jat: true, cursor: true, windsurf: true, cline: false },
		{ feature: '100% local', jat: true, cursor: false, windsurf: false, cline: true },
		{ feature: 'Open source', jat: true, cursor: false, windsurf: false, cline: true }
	];
</script>

<div class="min-h-screen bg-[var(--bg-base)]">
	<Nav />
	<HeroV2 />

	<!-- Quick Start Section -->
	<section id="demo" class="py-24 relative">
		<div class="max-w-4xl mx-auto px-6">
			<div class="flex items-center gap-3 mb-8">
				<svg class="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
				</svg>
				<h2 class="text-2xl font-bold text-white">Quick Start</h2>
			</div>

			<!-- Terminal mockup -->
			<div class="rounded-xl overflow-hidden border border-gray-800 bg-[#0d1117]">
				<!-- Terminal header -->
				<div class="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-gray-800">
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
						<div class="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
						<div class="w-3 h-3 rounded-full bg-[#27c93f]"></div>
					</div>
					<span class="text-xs text-gray-500 font-mono">terminal</span>
				</div>

				<!-- Terminal content -->
				<div class="p-6 font-mono text-sm">
					<div class="text-gray-500 mb-2"># Install globally</div>
					<div class="flex items-center gap-2 mb-4">
						<span class="text-[var(--color-primary)]">$</span>
						<span class="text-[#7ee787]">{installCommand}</span>
						<button
							onclick={copyCommand}
							class="ml-auto p-1.5 rounded hover:bg-gray-700 transition-colors"
						>
							{#if copied}
								<svg class="w-4 h-4 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
								</svg>
							{:else}
								<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
								</svg>
							{/if}
						</button>
					</div>

					<div class="text-gray-500 mb-2"># Restart shell</div>
					<div class="flex items-center gap-2 mb-4">
						<span class="text-[var(--color-primary)]">$</span>
						<span class="text-white">source ~/.bashrc</span>
					</div>

					<div class="text-gray-500 mb-2"># Launch the dashboard</div>
					<div class="flex items-center gap-2">
						<span class="text-[var(--color-primary)]">$</span>
						<span class="text-white">jat</span>
					</div>
				</div>
			</div>

			<p class="text-center text-gray-500 text-sm mt-4">
				Works on macOS & Linux. Node.js 20+ required.
			</p>
		</div>
	</section>

	<!-- The Alien Tool Problem - JAT styled -->
	<section class="py-24 bg-gradient-to-b from-transparent via-gray-900/50 to-transparent relative overflow-hidden">
		<div class="absolute inset-0 opacity-[0.02]" style="background-size: 40px 40px; background-image: linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px);"></div>

		<div class="max-w-5xl mx-auto px-6 relative z-10">
			<!-- Quote block -->
			<div class="relative mb-12">
				<div class="absolute -top-6 -left-4 text-6xl text-[var(--color-primary)]/20 font-serif">"</div>
				<blockquote class="text-lg md:text-xl text-gray-300 leading-relaxed pl-8 border-l-2 border-[var(--color-primary)]/30">
					<p class="mb-4">
						Clearly some powerful <span class="font-semibold text-white">alien tool</span> was handed around except it comes with no manual and everyone has to figure out how to hold it and operate it...
					</p>
				</blockquote>
				<cite class="block mt-4 pl-8 text-sm text-gray-500">
					— <a href="https://x.com/karpathy/status/2004607146781278521" target="_blank" rel="noopener noreferrer" class="text-[var(--color-primary)] hover:underline">@karpathy</a>, on the state of AI-assisted programming
				</cite>
			</div>

			<!-- The solution -->
			<div class="grid md:grid-cols-2 gap-6">
				<!-- Without structure -->
				<div class="p-6 rounded-xl bg-gray-900/50 border border-gray-800">
					<h3 class="text-sm font-mono text-red-400/80 mb-4 flex items-center gap-2">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
						WITHOUT STRUCTURE
					</h3>
					<div class="space-y-2 text-sm text-gray-500">
						{#each ['Agents running unconstrained', 'No file coordination', 'Lost context between sessions', 'Constant supervision required'] as item}
							<div class="flex items-center gap-2">
								<span class="w-1.5 h-1.5 rounded-full bg-red-500/50"></span>
								{item}
							</div>
						{/each}
					</div>
				</div>

				<!-- With JAT -->
				<div class="p-6 rounded-xl bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/30">
					<h3 class="text-sm font-mono text-[var(--color-success)] mb-4 flex items-center gap-2">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
						</svg>
						WITH JAT
					</h3>
					<div class="space-y-2 text-sm">
						{#each [
							'File reservations prevent conflicts',
							'Session context persists',
							'40+ agents working in parallel',
							'Async oversight check in when ready'
						] as item}
							<div class="flex items-center gap-2 text-[var(--color-primary)]">
								<svg class="w-4 h-4 text-[var(--color-success)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
								</svg>
								{item}
							</div>
						{/each}
					</div>
				</div>
			</div>

			<p class="text-center text-gray-500 mt-8">
				The alien tool came with no manual. <span class="text-white font-semibold">So we wrote one.</span>
			</p>
		</div>
	</section>

	<!-- Agentic Flywheel Section -->
	<section class="py-24">
		<div class="max-w-4xl mx-auto px-6">
			<h2 class="text-3xl font-bold text-white text-center mb-4">The Agentic Flywheel</h2>
			<p class="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
				A perpetual motion workflow. Tasks flow in, code ships out.
			</p>

			<div class="grid gap-3 font-mono text-sm">
				{#each workflowSteps as step, i}
					<div
						class="flex items-center gap-4 p-4 rounded-lg border border-gray-800 bg-gray-900/50 hover:border-[var(--color-primary)]/50 transition-colors"
					>
						<div class="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center font-bold text-sm">
							{step.num}
						</div>
						<div class="flex-1">
							<span class="text-white font-semibold">{step.title}</span>
							<span class="text-gray-500 ml-2">— {step.desc}</span>
						</div>
						{#if i < 8}
							<svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
							</svg>
						{:else}
							<svg class="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
							</svg>
						{/if}
					</div>
				{/each}
			</div>

			<p class="text-center text-[var(--color-primary)] font-semibold mt-8">
				Perpetual motion. Ship continuously.
			</p>
		</div>
	</section>

	<!-- What's Different Section -->
	<section class="py-24 bg-gradient-to-b from-transparent via-[var(--color-primary)]/5 to-transparent">
		<div class="max-w-5xl mx-auto px-6">
			<h2 class="text-3xl font-bold text-white text-center mb-4">What Makes JAT Different</h2>
			<p class="text-gray-400 text-center mb-12">
				Not another AI editor. The control tower for your agent swarm.
			</p>

			<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each features as feature}
					<div class="p-6 rounded-xl border border-gray-800 bg-gray-900/30 hover:border-[var(--color-primary)]/30 transition-colors group">
						<div class="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 flex items-center justify-center mb-4 group-hover:bg-[var(--color-primary)]/20 transition-colors">
							{#if feature.icon === 'swarm'}
								<svg class="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<circle cx="6" cy="6" r="2" stroke-width="2"/>
									<circle cx="18" cy="6" r="2" stroke-width="2"/>
									<circle cx="6" cy="18" r="2" stroke-width="2"/>
									<circle cx="18" cy="18" r="2" stroke-width="2"/>
									<circle cx="12" cy="12" r="3" stroke-width="2"/>
								</svg>
							{:else if feature.icon === 'tasks'}
								<svg class="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
								</svg>
							{:else if feature.icon === 'epic'}
								<svg class="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
								</svg>
							{:else if feature.icon === 'question'}
								<svg class="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
								</svg>
							{:else if feature.icon === 'auto'}
								<svg class="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
								</svg>
							{:else if feature.icon === 'local'}
								<svg class="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
								</svg>
							{/if}
						</div>
						<h3 class="text-lg font-semibold text-white mb-2">{feature.title}</h3>
						<p class="text-gray-400 text-sm">{feature.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Comparison Table -->
	<section class="py-24">
		<div class="max-w-4xl mx-auto px-6">
			<h2 class="text-3xl font-bold text-white text-center mb-4">JAT vs Other AI Coding Tools</h2>
			<p class="text-gray-400 text-center mb-12">
				JAT isn't trying to replace your editor it's the control tower for your agent swarm.
			</p>

			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-800">
							<th class="text-left py-4 px-4 text-gray-400 font-medium">Feature</th>
							<th class="text-center py-4 px-4 text-[var(--color-primary)] font-bold">JAT</th>
							<th class="text-center py-4 px-4 text-gray-400 font-medium">Cursor</th>
							<th class="text-center py-4 px-4 text-gray-400 font-medium">Windsurf</th>
							<th class="text-center py-4 px-4 text-gray-400 font-medium">Cline/Aider</th>
						</tr>
					</thead>
					<tbody>
						{#each comparison as row}
							<tr class="border-b border-gray-800/50 hover:bg-gray-900/30">
								<td class="py-3 px-4 text-white">{row.feature}</td>
								<td class="py-3 px-4 text-center">
									{#if row.jat}
										<svg class="w-5 h-5 text-[var(--color-success)] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
										</svg>
									{:else}
										<svg class="w-5 h-5 text-gray-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
										</svg>
									{/if}
								</td>
								<td class="py-3 px-4 text-center">
									{#if row.cursor}
										<svg class="w-5 h-5 text-[var(--color-success)] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
										</svg>
									{:else}
										<svg class="w-5 h-5 text-gray-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
										</svg>
									{/if}
								</td>
								<td class="py-3 px-4 text-center">
									{#if row.windsurf}
										<svg class="w-5 h-5 text-[var(--color-success)] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
										</svg>
									{:else}
										<svg class="w-5 h-5 text-gray-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
										</svg>
									{/if}
								</td>
								<td class="py-3 px-4 text-center">
									{#if row.cline}
										<svg class="w-5 h-5 text-[var(--color-success)] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
										</svg>
									{:else}
										<svg class="w-5 h-5 text-gray-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
										</svg>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</section>

	<Footer />
</div>
