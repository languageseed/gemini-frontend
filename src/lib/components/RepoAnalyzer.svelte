<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Github, Search, Loader2, AlertCircle, CheckCircle, Code, Zap, Shield, Bug, Layout } from 'lucide-svelte';
	import { api } from '$lib/utils/api';

	const dispatch = createEventDispatcher<{ 
		analyze: { repo: string; focus: string };
		complete: { analysis: string; toolCalls: any[]; iterations: number };
	}>();

	let repoUrl = '';
	let focus = 'all';
	let isAnalyzing = false;
	let error: string | null = null;
	
	// Progress state
	let progressEvents: ProgressEvent[] = [];
	let currentStep = '';
	let iteration = 0;

	interface ProgressEvent {
		type: string;
		message: string;
		timestamp: Date;
		data?: any;
	}

	const focusOptions = [
		{ value: 'all', label: 'Full Analysis', description: 'Bugs, security, performance, architecture', icon: Zap },
		{ value: 'bugs', label: 'Bug Detection', description: 'Logic errors, edge cases, error handling', icon: Bug },
		{ value: 'security', label: 'Security Audit', description: 'Vulnerabilities, injection risks, auth issues', icon: Shield },
		{ value: 'performance', label: 'Performance', description: 'Bottlenecks, inefficient algorithms', icon: Zap },
		{ value: 'architecture', label: 'Architecture', description: 'Patterns, modularity, maintainability', icon: Layout },
	];

	function addProgress(type: string, message: string, data?: any) {
		progressEvents = [...progressEvents, { type, message, timestamp: new Date(), data }];
	}

	async function handleSubmit() {
		if (!repoUrl.trim()) {
			error = 'Please enter a repository URL';
			return;
		}

		error = null;
		isAnalyzing = true;
		progressEvents = [];
		currentStep = 'Connecting to server...';
		iteration = 0;

		try {
			// Get API key from api utility
			const apiKey = api.getApiKey() || '';
			
			// Build SSE URL
			const baseUrl = import.meta.env.VITE_API_URL || 'https://gemini-agent-hackathon-production.up.railway.app';
			
			addProgress('start', `Starting analysis of ${repoUrl}`);
			currentStep = 'Initializing agent...';

			// Use fetch with streaming
			const response = await fetch(`${baseUrl}/v3/analyze/stream`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': apiKey,
				},
				body: JSON.stringify({
					repo_url: repoUrl.trim(),
					focus,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ detail: response.statusText }));
				throw new Error(errorData.detail || `Request failed: ${response.status}`);
			}

			// Read the SSE stream
			const reader = response.body?.getReader();
			const decoder = new TextDecoder();

			if (!reader) {
				throw new Error('Failed to get response stream');
			}

			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				
				// Process complete SSE events (split by double newline)
				const events = buffer.split('\n\n');
				buffer = events.pop() || ''; // Keep incomplete event in buffer

				for (const eventStr of events) {
					if (!eventStr.trim() || !eventStr.startsWith('data:')) continue;
					
					try {
						const jsonStr = eventStr.replace('data:', '').trim();
						const event = JSON.parse(jsonStr);
						
						handleStreamEvent(event);
						
						// Check if done
						if (event.type === 'done') {
							dispatch('complete', {
								analysis: event.analysis || '',
								toolCalls: event.tool_calls || [],
								iterations: event.iterations || 0,
							});
							isAnalyzing = false;
							currentStep = 'Analysis complete!';
							addProgress('done', `Completed in ${event.iterations} iterations`);
							return;
						}
						
						if (event.type === 'error') {
							throw new Error(event.error || 'Unknown error');
						}
					} catch (parseError) {
						console.warn('Failed to parse SSE event:', eventStr, parseError);
					}
				}
			}

		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : 'Analysis failed';
			error = errorMessage;
			addProgress('error', errorMessage);
		} finally {
			isAnalyzing = false;
		}
	}

	function handleStreamEvent(event: any) {
		switch (event.type) {
			case 'start':
				currentStep = 'Agent started...';
				addProgress('start', `Task: ${event.task?.substring(0, 100) || 'Analyzing repository'}...`);
				break;
				
			case 'thinking':
				iteration = event.iteration || iteration;
				currentStep = `Iteration ${iteration}: Reasoning (${event.level} thinking)...`;
				addProgress('thinking', `Iteration ${event.iteration}: ${event.level} thinking`);
				break;
				
			case 'tool_start':
				const toolName = event.name || 'Unknown tool';
				const toolMessage = getToolMessage(toolName, event.arguments);
				currentStep = toolMessage;
				addProgress('tool', toolMessage, event);
				break;
				
			case 'tool_result':
				const resultPreview = event.output?.substring(0, 100) || 'Completed';
				addProgress('result', `${event.name}: ${resultPreview}...`, event);
				break;
				
			case 'token':
				// Could show streaming text here
				currentStep = 'Generating analysis...';
				break;
				
			case 'heartbeat':
				// Keep-alive, no action needed
				break;
		}
	}

	function getToolMessage(toolName: string, args?: any): string {
		switch (toolName) {
			case 'clone_repo':
				return `Cloning repository: ${args?.repo_url || repoUrl}...`;
			case 'analyze_code':
				return `Analyzing code: ${args?.path || 'files'}...`;
			case 'execute_code':
				return 'Executing verification code...';
			case 'search_code':
				return `Searching for: ${args?.query || 'patterns'}...`;
			default:
				return `Running: ${toolName}...`;
		}
	}

	function setExample(url: string) {
		repoUrl = url;
	}

	function getEventIcon(type: string) {
		switch (type) {
			case 'start': return Zap;
			case 'thinking': return Code;
			case 'tool': return Github;
			case 'result': return CheckCircle;
			case 'done': return CheckCircle;
			case 'error': return AlertCircle;
			default: return Code;
		}
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

		<!-- Progress Display -->
		{#if isAnalyzing || progressEvents.length > 0}
			<div class="rounded-lg border border-border bg-background p-4">
				<!-- Current Step -->
				{#if isAnalyzing}
					<div class="mb-3 flex items-center gap-2">
						<Loader2 class="h-4 w-4 animate-spin text-primary" />
						<span class="text-sm font-medium">{currentStep}</span>
						{#if iteration > 0}
							<span class="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
								Iteration {iteration}
							</span>
						{/if}
					</div>
				{/if}

				<!-- Progress Log -->
				<div class="max-h-48 space-y-1 overflow-y-auto text-xs">
					{#each progressEvents as event, i}
						{@const Icon = getEventIcon(event.type)}
						<div class="flex items-start gap-2 py-1 {event.type === 'error' ? 'text-destructive' : 'text-muted-foreground'}">
							<Icon class="mt-0.5 h-3 w-3 flex-shrink-0" />
							<span class="flex-1">{event.message}</span>
							<span class="text-[10px] opacity-50">
								{event.timestamp.toLocaleTimeString()}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

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
