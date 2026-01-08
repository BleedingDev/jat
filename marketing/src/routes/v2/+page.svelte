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
					<div class="flex items-center gap-4">
						<div class="flex items-center gap-2 text-xs">
							<span class="px-2 py-1 rounded bg-[var(--color-primary)] text-white font-medium">Quick</span>
							<span class="px-2 py-1 rounded bg-gray-700 text-gray-400 hover:bg-gray-600 cursor-pointer">Hackable</span>
						</div>
					</div>
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

	<!-- Agentic Flywheel Section -->
	<section class="py-24 bg-gradient-to-b from-transparent via-[var(--color-primary)]/5 to-transparent">
		<div class="max-w-4xl mx-auto px-6">
			<h2 class="text-3xl font-bold text-white text-center mb-4">The Agentic Flywheel</h2>
			<p class="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
				A perpetual motion workflow. Tasks flow in, code ships out.
			</p>

			<div class="grid gap-3 font-mono text-sm">
				{#each [
					{ num: '1', title: 'PLAN WITH AI', desc: 'Describe your feature, get a PRD' },
					{ num: '2', title: '/JAT:BEAD', desc: 'Convert PRD → structured tasks' },
					{ num: '3', title: 'EPIC SWARM', desc: 'Spawn agents on subtasks' },
					{ num: '4', title: 'PARALLEL WORK', desc: 'Watch agents code simultaneously' },
					{ num: '5', title: 'SMART QUESTIONS', desc: '"OAuth or JWT?" → click button' },
					{ num: '6', title: 'REVIEW IN /files', desc: 'See diffs, check code' },
					{ num: '7', title: 'COMMIT & PUSH', desc: 'Stage, message, push' },
					{ num: '8', title: 'AUTO-PROCEED', desc: 'Low-priority tasks complete auto' },
					{ num: '9', title: 'SUGGESTED TASKS', desc: 'Agent proposes next work → loop' }
				] as step, i}
					<div
						class="flex items-center gap-4 p-4 rounded-lg border border-gray-800 bg-gray-900/50 hover:border-[var(--color-primary)]/50 transition-colors"
						style="animation-delay: {i * 50}ms"
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
				∞ Perpetual motion. Ship continuously. ∞
			</p>
		</div>
	</section>

	<!-- What's Different Section -->
	<section class="py-24">
		<div class="max-w-5xl mx-auto px-6">
			<h2 class="text-3xl font-bold text-white text-center mb-4">What Makes JAT Different</h2>
			<p class="text-gray-400 text-center mb-12">
				Not another AI editor. The control tower for your agent swarm.
			</p>

			<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each [
					{ icon: '🐝', title: 'Multi-Agent (20+)', desc: 'Run dozens of agents simultaneously across your codebase' },
					{ icon: '📋', title: 'Built-in Tasks', desc: 'Beads-powered task management with dependencies' },
					{ icon: '⚡', title: 'Epic Swarm', desc: 'Spawn parallel agents on epic subtasks' },
					{ icon: '🤖', title: 'Smart Questions', desc: 'Agent questions become clickable buttons' },
					{ icon: '🔄', title: 'Auto-Proceed', desc: 'Configure rules for automatic completion' },
					{ icon: '🔒', title: '100% Local', desc: 'Your code never leaves your machine' }
				] as feature}
					<div class="p-6 rounded-xl border border-gray-800 bg-gray-900/30 hover:border-[var(--color-primary)]/30 transition-colors">
						<div class="text-3xl mb-3">{feature.icon}</div>
						<h3 class="text-lg font-semibold text-white mb-2">{feature.title}</h3>
						<p class="text-gray-400 text-sm">{feature.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<Footer />
</div>
