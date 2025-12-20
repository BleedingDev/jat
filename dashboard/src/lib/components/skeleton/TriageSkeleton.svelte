<script lang="ts">
	/**
	 * TriageSkeleton Component
	 * Shows animated placeholder for the triage/dispatch page
	 * Matches the mission control aesthetic with section groupings
	 */

	interface Props {
		/** Number of cards to show */
		cards?: number;
	}

	let { cards = 4 }: Props = $props();
</script>

<!-- Triage Skeleton - Theme-aware -->
<div class="min-h-screen relative overflow-hidden bg-base-300 font-mono">
	<!-- Subtle grid overlay -->
	<div
		class="absolute inset-0 pointer-events-none opacity-[0.03]"
		style="
			background-image:
				linear-gradient(currentColor 1px, transparent 1px),
				linear-gradient(90deg, currentColor 1px, transparent 1px);
			background-size: 40px 40px;
		"
	></div>

	<div class="relative z-10 p-6 max-w-7xl mx-auto">
		<!-- Header Skeleton -->
		<header class="mb-8">
			<div class="flex items-center justify-between">
				<div>
					<div class="skeleton h-8 w-48 rounded mb-2 bg-base-content/20"></div>
					<div class="skeleton h-4 w-36 rounded bg-base-content/15"></div>
				</div>

				<!-- Status indicator skeleton -->
				<div class="flex items-center gap-3 px-4 py-2 rounded-lg bg-base-200 border border-base-content/20">
					<div class="w-3 h-3 rounded-full skeleton bg-primary/50"></div>
					<div class="skeleton h-4 w-20 rounded bg-base-content/20"></div>
				</div>
			</div>
		</header>

		<!-- Needs Input Section Skeleton -->
		<section class="mb-8">
			<div class="flex items-center gap-3 mb-4">
				<div class="w-2 h-8 rounded-full bg-warning/70"></div>
				<div class="skeleton h-5 w-28 rounded bg-warning/30"></div>
				<div class="skeleton h-5 w-6 rounded-full bg-warning/20"></div>
			</div>

			<div class="grid gap-4">
				{#each Array(Math.ceil(cards / 2)) as _, i}
					<!-- Card Skeleton -->
					<div
						class="group relative rounded-xl overflow-hidden bg-warning/10 border border-warning/30"
						style="animation: fadeIn 0.3s ease-out; animation-delay: {i * 100}ms; animation-fill-mode: both;"
					>
						<!-- Accent bar -->
						<div class="absolute left-0 top-0 bottom-0 w-1 bg-warning/80"></div>

						<div class="p-5 pl-6">
							<!-- Header row -->
							<div class="flex items-start justify-between mb-3">
								<div class="flex items-center gap-3">
									<div class="skeleton w-2.5 h-2.5 rounded-full bg-warning/60"></div>
									<div class="skeleton h-5 w-24 rounded bg-base-content/15"></div>
									<div class="skeleton h-5 w-16 rounded bg-base-content/12"></div>
								</div>
								<div class="skeleton h-6 w-20 rounded bg-warning/25"></div>
							</div>

							<!-- Task title -->
							<div class="skeleton h-4 w-3/4 rounded mb-3 bg-base-content/12"></div>

							<!-- Question excerpt -->
							<div class="p-3 rounded-lg bg-base-300/80 border-l-2 border-warning/50">
								<div class="skeleton h-4 w-full rounded mb-2 bg-base-content/10"></div>
								<div class="skeleton h-4 w-2/3 rounded bg-base-content/10"></div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- Ready for Review Section Skeleton -->
		<section class="mb-8">
			<div class="flex items-center gap-3 mb-4">
				<div class="w-2 h-8 rounded-full bg-success/70"></div>
				<div class="skeleton h-5 w-36 rounded bg-success/30"></div>
				<div class="skeleton h-5 w-6 rounded-full bg-success/20"></div>
			</div>

			<div class="grid gap-4">
				{#each Array(Math.floor(cards / 2)) as _, i}
					<!-- Card Skeleton -->
					<div
						class="group relative rounded-xl overflow-hidden bg-success/10 border border-success/25"
						style="animation: fadeIn 0.3s ease-out; animation-delay: {(i + 2) * 100}ms; animation-fill-mode: both;"
					>
						<!-- Accent bar -->
						<div class="absolute left-0 top-0 bottom-0 w-1 bg-success/80"></div>

						<div class="p-5 pl-6">
							<!-- Header row -->
							<div class="flex items-start justify-between mb-3">
								<div class="flex items-center gap-3">
									<span class="text-lg">🔍</span>
									<div class="skeleton h-5 w-24 rounded bg-base-content/15"></div>
									<div class="skeleton h-5 w-16 rounded bg-base-content/12"></div>
								</div>
								<div class="skeleton h-6 w-18 rounded bg-success/25"></div>
							</div>

							<!-- Task title -->
							<div class="skeleton h-4 w-2/3 rounded mb-3 bg-base-content/12"></div>

							<!-- Changes summary -->
							<div class="p-3 rounded-lg bg-base-300/80 border-l-2 border-success/50">
								<div class="skeleton h-4 w-full rounded mb-2 bg-base-content/10"></div>
								<div class="skeleton h-4 w-1/2 rounded bg-base-content/10"></div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- Working Section Skeleton (collapsed) -->
		<section class="mt-8">
			<div class="flex items-center gap-3 mb-4">
				<div class="w-2 h-6 rounded-full bg-primary/55"></div>
				<div class="skeleton h-4 w-32 rounded bg-base-content/15"></div>
				<div class="skeleton h-5 w-6 rounded-full bg-base-content/10"></div>
				<div class="skeleton w-4 h-4 rounded bg-base-content/10"></div>
			</div>
		</section>

		<!-- Center loading indicator -->
		<div class="flex items-center justify-center mt-8">
			<div class="flex flex-col items-center gap-3">
				<div class="w-8 h-8 rounded-full border-2 animate-spin border-primary border-t-transparent"></div>
				<span class="text-sm text-base-content/50">Scanning sessions...</span>
			</div>
		</div>
	</div>
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
