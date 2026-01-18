<script lang="ts">
	import { 
		AlertCircle, CheckCircle, XCircle, HelpCircle, 
		ChevronDown, ChevronUp, Copy, Check,
		Bug, Shield, Zap, Palette, Layout, FileCode
	} from 'lucide-svelte';

	export let issue: {
		id: string;
		title: string;
		description: string;
		severity: 'critical' | 'high' | 'medium' | 'low';
		category: 'bug' | 'security' | 'performance' | 'style' | 'architecture';
		file_path: string;
		line_number?: number;
		code_snippet?: string;
		recommendation?: string;
		recommended_code?: string;
		verification_status: 'pending' | 'verified' | 'unverified' | 'skipped' | 'error';
		test_code?: string;
		test_output?: string;
	};

	let expanded = false;
	let copiedSnippet = false;
	let copiedFix = false;
	let copiedTest = false;

	const severityColors = {
		critical: 'bg-red-500/20 text-red-400 border-red-500/30',
		high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
		medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
		low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
	};

	const severityBadgeColors = {
		critical: 'bg-red-500 text-white',
		high: 'bg-orange-500 text-white',
		medium: 'bg-yellow-500 text-black',
		low: 'bg-gray-500 text-white',
	};

	const categoryIcons = {
		bug: Bug,
		security: Shield,
		performance: Zap,
		style: Palette,
		architecture: Layout,
	};

	const verificationIcons = {
		pending: HelpCircle,
		verified: CheckCircle,
		unverified: XCircle,
		skipped: HelpCircle,
		error: AlertCircle,
	};

	const verificationColors = {
		pending: 'text-gray-400',
		verified: 'text-green-400',
		unverified: 'text-yellow-400',
		skipped: 'text-gray-400',
		error: 'text-red-400',
	};

	const verificationLabels = {
		pending: 'Pending',
		verified: 'Verified',
		unverified: 'Unverified',
		skipped: 'Skipped',
		error: 'Error',
	};

	async function copyToClipboard(text: string, type: 'snippet' | 'fix' | 'test') {
		await navigator.clipboard.writeText(text);
		if (type === 'snippet') {
			copiedSnippet = true;
			setTimeout(() => copiedSnippet = false, 2000);
		} else if (type === 'fix') {
			copiedFix = true;
			setTimeout(() => copiedFix = false, 2000);
		} else {
			copiedTest = true;
			setTimeout(() => copiedTest = false, 2000);
		}
	}

	$: CategoryIcon = categoryIcons[issue.category] || Bug;
	$: VerificationIcon = verificationIcons[issue.verification_status] || HelpCircle;
</script>

<div class="rounded-lg border {severityColors[issue.severity]} overflow-hidden">
	<!-- Header -->
	<button
		type="button"
		on:click={() => expanded = !expanded}
		class="w-full flex items-start gap-3 p-4 text-left hover:bg-white/5 transition-colors"
	>
		<!-- Severity Badge -->
		<span class="shrink-0 rounded px-2 py-0.5 text-xs font-bold uppercase {severityBadgeColors[issue.severity]}">
			{issue.severity}
		</span>

		<!-- Category Icon -->
		<svelte:component this={CategoryIcon} class="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />

		<!-- Title & File -->
		<div class="flex-1 min-w-0">
			<div class="font-medium text-sm truncate">{issue.title}</div>
			<div class="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
				<FileCode class="h-3 w-3" />
				<span class="truncate">{issue.file_path}{issue.line_number ? `:${issue.line_number}` : ''}</span>
			</div>
		</div>

		<!-- Verification Status -->
		<div class="shrink-0 flex items-center gap-1 {verificationColors[issue.verification_status]}">
			<svelte:component this={VerificationIcon} class="h-4 w-4" />
			<span class="text-xs font-medium">{verificationLabels[issue.verification_status]}</span>
		</div>

		<!-- Expand Icon -->
		<div class="shrink-0 text-muted-foreground">
			{#if expanded}
				<ChevronUp class="h-4 w-4" />
			{:else}
				<ChevronDown class="h-4 w-4" />
			{/if}
		</div>
	</button>

	<!-- Expanded Content -->
	{#if expanded}
		<div class="border-t border-border/50 p-4 space-y-4 bg-black/20">
			<!-- Description -->
			<div>
				<div class="text-xs font-medium text-muted-foreground mb-1">Description</div>
				<p class="text-sm">{issue.description}</p>
			</div>

			<!-- Problematic Code -->
			{#if issue.code_snippet}
				<div>
					<div class="flex items-center justify-between mb-1">
						<div class="text-xs font-medium text-muted-foreground">Problematic Code</div>
						<button
							type="button"
							on:click={() => copyToClipboard(issue.code_snippet || '', 'snippet')}
							class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
						>
							{#if copiedSnippet}
								<Check class="h-3 w-3 text-green-400" />
								Copied
							{:else}
								<Copy class="h-3 w-3" />
								Copy
							{/if}
						</button>
					</div>
					<pre class="rounded bg-secondary/50 p-3 text-xs overflow-x-auto font-mono">{issue.code_snippet}</pre>
				</div>
			{/if}

			<!-- Recommendation -->
			{#if issue.recommendation}
				<div>
					<div class="text-xs font-medium text-muted-foreground mb-1">💡 Recommendation</div>
					<p class="text-sm">{issue.recommendation}</p>
				</div>
			{/if}

			<!-- Recommended Fix -->
			{#if issue.recommended_code}
				<div>
					<div class="flex items-center justify-between mb-1">
						<div class="text-xs font-medium text-muted-foreground">Suggested Fix</div>
						<button
							type="button"
							on:click={() => copyToClipboard(issue.recommended_code || '', 'fix')}
							class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
						>
							{#if copiedFix}
								<Check class="h-3 w-3 text-green-400" />
								Copied
							{:else}
								<Copy class="h-3 w-3" />
								Copy
							{/if}
						</button>
					</div>
					<pre class="rounded bg-green-500/10 border border-green-500/20 p-3 text-xs overflow-x-auto font-mono">{issue.recommended_code}</pre>
				</div>
			{/if}

			<!-- Verification Test -->
			{#if issue.test_code && issue.verification_status !== 'skipped'}
				<div>
					<div class="flex items-center justify-between mb-1">
						<div class="text-xs font-medium text-muted-foreground flex items-center gap-1">
							🧪 Verification Test
							{#if issue.verification_status === 'verified'}
								<span class="text-green-400">(Failed as expected - bug confirmed!)</span>
							{:else if issue.verification_status === 'unverified'}
								<span class="text-yellow-400">(Passed - may be false positive)</span>
							{/if}
						</div>
						<button
							type="button"
							on:click={() => copyToClipboard(issue.test_code || '', 'test')}
							class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
						>
							{#if copiedTest}
								<Check class="h-3 w-3 text-green-400" />
								Copied
							{:else}
								<Copy class="h-3 w-3" />
								Copy
							{/if}
						</button>
					</div>
					<pre class="rounded bg-blue-500/10 border border-blue-500/20 p-3 text-xs overflow-x-auto font-mono">{issue.test_code}</pre>
				</div>
			{/if}

			<!-- Test Output -->
			{#if issue.test_output}
				<div>
					<div class="text-xs font-medium text-muted-foreground mb-1">Test Output</div>
					<pre class="rounded bg-secondary/50 p-3 text-xs overflow-x-auto font-mono text-muted-foreground">{issue.test_output}</pre>
				</div>
			{/if}
		</div>
	{/if}
</div>
