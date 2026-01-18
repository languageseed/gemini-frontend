<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Github, Search, Loader2, AlertCircle } from 'lucide-svelte';

	const dispatch = createEventDispatcher<{ analyze: { repo: string; focus: string } }>();

	let repoUrl = '';
	let focus = 'all';
	let isAnalyzing = false;
	let error: string | null = null;

	const focusOptions = [
		{ value: 'all', label: 'Full Analysis', description: 'Bugs, security, performance, architecture' },
		{ value: 'bugs', label: 'Bug Detection', description: 'Logic errors, edge cases, error handling' },
		{ value: 'security', label: 'Security Audit', description: 'Vulnerabilities, injection risks, auth issues' },
		{ value: 'performance', label: 'Performance', description: 'Bottlenecks, inefficient algorithms' },
		{ value: 'architecture', label: 'Architecture', description: 'Patterns, modularity, maintainability' },
	];

	function handleSubmit() {
		if (!repoUrl.trim()) {
			error = 'Please enter a repository URL';
			return;
		}

		error = null;
		dispatch('analyze', { repo: repoUrl.trim(), focus });
	}

	function setExample(url: string) {
		repoUrl = url;
	}
</script>

<div class="rounded-lg border border-border bg-secondary/30 p-6">
	<div class="mb-4 flex items-center gap-2">
		<Github class="h-5 w-5" />
		<h3 class="text-lg font-semibold">Codebase Analyst</h3>
		<span class="rounded bg-primary/20 px-2 py-0.5 text-xs text-primary">Beta</span>
	</div>

	<p class="mb-4 text-sm text-muted-foreground">
		Analyze entire GitHub repositories using Gemini's 2M token context window. 
		Load full codebases and get comprehensive analysis in minutes.
	</p>

	<form on:submit|preventDefault={handleSubmit} class="space-y-4">
		<!-- Repository URL -->
		<div>
			<label for="repo-url" class="mb-1 block text-sm font-medium">Repository URL</label>
			<div class="flex gap-2">
				<input
					id="repo-url"
					type="text"
					bind:value={repoUrl}
					placeholder="https://github.com/owner/repo or owner/repo"
					class="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					disabled={isAnalyzing}
				/>
			</div>
			<div class="mt-1 flex gap-2 text-xs text-muted-foreground">
				<span>Try:</span>
				<button type="button" on:click={() => setExample('facebook/react')} class="text-primary hover:underline">
					facebook/react
				</button>
				<button type="button" on:click={() => setExample('sveltejs/svelte')} class="text-primary hover:underline">
					sveltejs/svelte
				</button>
				<button type="button" on:click={() => setExample('fastapi/fastapi')} class="text-primary hover:underline">
					fastapi/fastapi
				</button>
			</div>
		</div>

		<!-- Focus Area -->
		<div>
			<label class="mb-2 block text-sm font-medium">Analysis Focus</label>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each focusOptions as option}
					<label
						class="flex cursor-pointer items-start gap-2 rounded-lg border border-input p-3 transition-colors hover:bg-secondary/50 {focus === option.value ? 'border-primary bg-primary/10' : ''}"
					>
						<input
							type="radio"
							name="focus"
							value={option.value}
							bind:group={focus}
							class="mt-0.5"
							disabled={isAnalyzing}
						/>
						<div>
							<div class="text-sm font-medium">{option.label}</div>
							<div class="text-xs text-muted-foreground">{option.description}</div>
						</div>
					</label>
				{/each}
			</div>
		</div>

		<!-- Error -->
		{#if error}
			<div class="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
				<AlertCircle class="h-4 w-4" />
				{error}
			</div>
		{/if}

		<!-- Submit -->
		<button
			type="submit"
			disabled={isAnalyzing || !repoUrl.trim()}
			class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if isAnalyzing}
				<Loader2 class="h-4 w-4 animate-spin" />
				Analyzing Repository...
			{:else}
				<Search class="h-4 w-4" />
				Analyze Repository
			{/if}
		</button>
	</form>

	<div class="mt-4 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
		<strong>How it works:</strong> The agent clones the repository via GitHub API, loads all code files 
		into Gemini's 2M token context (no chunking needed), and performs comprehensive analysis. 
		Large repos may take 1-2 minutes.
	</div>
</div>
