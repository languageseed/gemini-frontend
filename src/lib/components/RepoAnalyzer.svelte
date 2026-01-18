<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { 
		Github, Search, Loader2, AlertCircle, CheckCircle, Code, Zap, 
		Shield, Bug, Layout, Clock, Activity, Brain, Wrench, 
		ChevronDown, ChevronUp, BarChart3, Cpu, Timer
	} from 'lucide-svelte';
	import { api } from '$lib/utils/api';

	const dispatch = createEventDispatcher<{ 
		analyze: { repo: string; focus: string };
		complete: { analysis: string; toolCalls: any[]; iterations: number };
	}>();

	let repoUrl = '';
	let focus = 'all';
	let isAnalyzing = false;
	let error: string | null = null;
	
	// Observability state
	let startTime: Date | null = null;
	let elapsedSeconds = 0;
	let elapsedInterval: ReturnType<typeof setInterval> | null = null;
	
	// Progress tracking
	let currentPhase = '';
	let currentStep = '';
	let iteration = 0;
	let maxIterations = 20;
	
	// Metrics
	let tokensEstimated = 0;
	let toolCallsCount = 0;
	let filesAnalyzed = 0;
	
	// Event log
	let events: ProgressEvent[] = [];
	let showFullLog = false;
	
	// Tool calls tracking
	let activeTools: Map<string, { startTime: Date; status: 'running' | 'done' | 'error' }> = new Map();
	let completedTools: ToolExecution[] = [];

	interface ProgressEvent {
		type: string;
		message: string;
		timestamp: Date;
		data?: any;
		phase?: string;
	}

	interface ToolExecution {
		name: string;
		args: any;
		duration: number;
		output: string;
		success: boolean;
	}

	const focusOptions = [
		{ value: 'all', label: 'Full Analysis', description: 'Bugs, security, performance, architecture', icon: Zap },
		{ value: 'bugs', label: 'Bug Detection', description: 'Logic errors, edge cases, error handling', icon: Bug },
		{ value: 'security', label: 'Security Audit', description: 'Vulnerabilities, injection risks, auth issues', icon: Shield },
		{ value: 'performance', label: 'Performance', description: 'Bottlenecks, inefficient algorithms', icon: Zap },
		{ value: 'architecture', label: 'Architecture', description: 'Patterns, modularity, maintainability', icon: Layout },
	];

	const phases = [
		{ id: 'init', label: 'Initializing', icon: Zap },
		{ id: 'clone', label: 'Cloning Repo', icon: Github },
		{ id: 'analyze', label: 'Analyzing', icon: Brain },
		{ id: 'report', label: 'Generating Report', icon: Code },
		{ id: 'done', label: 'Complete', icon: CheckCircle },
	];

	function addEvent(type: string, message: string, phase?: string, data?: any) {
		events = [...events, { type, message, timestamp: new Date(), phase, data }];
		if (phase) currentPhase = phase;
	}

	function startTimer() {
		startTime = new Date();
		elapsedSeconds = 0;
		elapsedInterval = setInterval(() => {
			if (startTime) {
				elapsedSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
			}
		}, 1000);
	}

	function stopTimer() {
		if (elapsedInterval) {
			clearInterval(elapsedInterval);
			elapsedInterval = null;
		}
	}

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
	}

	function resetState() {
		events = [];
		activeTools = new Map();
		completedTools = [];
		iteration = 0;
		tokensEstimated = 0;
		toolCallsCount = 0;
		filesAnalyzed = 0;
		currentPhase = 'init';
		currentStep = '';
		error = null;
	}

	async function handleSubmit() {
		if (!repoUrl.trim()) {
			error = 'Please enter a repository URL';
			return;
		}

		error = null;
		isAnalyzing = true;
		resetState();
		startTimer();
		
		dispatch('analyze', { repo: repoUrl.trim(), focus });
		
		addEvent('start', `Starting analysis of ${repoUrl}`, 'init');
		currentStep = 'Connecting to server...';

		try {
			const apiKey = api.getApiKey() || '';
			const baseUrl = import.meta.env.VITE_API_URL || 'https://gemini-agent-hackathon-production.up.railway.app';

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
				
				const eventStrings = buffer.split('\n\n');
				buffer = eventStrings.pop() || '';

				for (const eventStr of eventStrings) {
					if (!eventStr.trim() || !eventStr.startsWith('data:')) continue;
					
					try {
						const jsonStr = eventStr.replace('data:', '').trim();
						const event = JSON.parse(jsonStr);
						
						handleStreamEvent(event);
						
						if (event.type === 'done') {
							stopTimer();
							currentPhase = 'done';
							addEvent('done', `Analysis complete in ${event.iterations} iterations`, 'done');
							
							dispatch('complete', {
								analysis: event.analysis || '',
								toolCalls: event.tool_calls || [],
								iterations: event.iterations || 0,
							});
							isAnalyzing = false;
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
			addEvent('error', errorMessage);
			stopTimer();
		} finally {
			isAnalyzing = false;
		}
	}

	function handleStreamEvent(event: any) {
		switch (event.type) {
			case 'start':
				currentStep = 'Agent initialized';
				addEvent('start', 'Agent started processing task', 'init');
				// Estimate tokens from task length
				tokensEstimated += (event.task?.length || 0) / 4;
				break;
				
			case 'thinking':
				iteration = event.iteration || iteration;
				const thinkingLevel = event.level || 'standard';
				currentStep = `Reasoning (${thinkingLevel} thinking)`;
				currentPhase = 'analyze';
				addEvent('thinking', `Iteration ${event.iteration}: ${thinkingLevel} thinking mode`, 'analyze', {
					iteration: event.iteration,
					level: thinkingLevel
				});
				// Estimate tokens for thinking
				tokensEstimated += thinkingLevel === 'high' ? 500 : thinkingLevel === 'medium' ? 300 : 100;
				break;
				
			case 'tool_start':
				const toolName = event.name || 'Unknown tool';
				toolCallsCount++;
				activeTools.set(toolName, { startTime: new Date(), status: 'running' });
				activeTools = activeTools; // Trigger reactivity
				
				const toolMessage = getToolMessage(toolName, event.arguments);
				currentStep = toolMessage;
				
				if (toolName === 'clone_repo') {
					currentPhase = 'clone';
					addEvent('tool', toolMessage, 'clone', event);
				} else {
					addEvent('tool', toolMessage, 'analyze', event);
				}
				break;
				
			case 'tool_result':
				const resultToolName = event.name || 'Unknown';
				const toolInfo = activeTools.get(resultToolName);
				const duration = toolInfo ? (Date.now() - toolInfo.startTime.getTime()) : 0;
				
				activeTools.delete(resultToolName);
				activeTools = activeTools;
				
				completedTools = [...completedTools, {
					name: resultToolName,
					args: event.arguments || {},
					duration,
					output: event.output?.substring(0, 200) || '',
					success: !event.output?.startsWith('Error')
				}];
				
				// Estimate files from clone_repo output
				if (resultToolName === 'clone_repo' && event.output) {
					const match = event.output.match(/Total files: (\d+)/);
					if (match) filesAnalyzed = parseInt(match[1]);
				}
				
				// Estimate tokens from output
				tokensEstimated += (event.output?.length || 0) / 4;
				
				addEvent('result', `${resultToolName} completed (${duration}ms)`, undefined, { 
					duration, 
					preview: event.output?.substring(0, 100) 
				});
				break;
				
			case 'token':
				currentStep = 'Generating analysis...';
				currentPhase = 'report';
				// Estimate tokens from generated text
				tokensEstimated += (event.content?.length || 0) / 4;
				break;
				
			case 'heartbeat':
				break;
		}
	}

	function getToolMessage(toolName: string, args?: any): string {
		switch (toolName) {
			case 'clone_repo':
				return `Cloning: ${args?.repo_url || repoUrl}`;
			case 'analyze_code':
				return `Analyzing: ${args?.path || 'code files'}`;
			case 'execute_code':
				return 'Running verification code...';
			case 'search_code':
				return `Searching: ${args?.query || 'patterns'}`;
			case 'read_file':
				return `Reading: ${args?.path || 'file'}`;
			default:
				return `Running: ${toolName}`;
		}
	}

	function setExample(url: string) {
		repoUrl = url;
	}

	function getPhaseIndex(phase: string): number {
		return phases.findIndex(p => p.id === phase);
	}
</script>

<div class="space-y-4">
	<!-- Input Card -->
	<div class="rounded-lg border border-border bg-secondary/30 p-6">
		<div class="mb-4 flex items-center gap-2">
			<Github class="h-5 w-5" />
			<h3 class="text-lg font-semibold">Codebase Analyst</h3>
			<span class="rounded bg-primary/20 px-2 py-0.5 text-xs text-primary">Beta</span>
		</div>

		<form on:submit|preventDefault={handleSubmit} class="space-y-4">
			<!-- Repository URL -->
			<div>
				<label for="repo-url" class="mb-1 block text-sm font-medium">Repository URL</label>
				<input
					id="repo-url"
					type="text"
					bind:value={repoUrl}
					placeholder="https://github.com/owner/repo or owner/repo"
					class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					disabled={isAnalyzing}
				/>
				<div class="mt-1 flex gap-2 text-xs text-muted-foreground">
					<span>Try:</span>
					{#each ['facebook/react', 'sveltejs/svelte', 'fastapi/fastapi'] as example}
						<button type="button" on:click={() => setExample(example)} class="text-primary hover:underline">
							{example}
						</button>
					{/each}
				</div>
			</div>

			<!-- Focus Area -->
			<div>
				<span class="mb-2 block text-sm font-medium">Analysis Focus</span>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
					{#each focusOptions as option}
						<label
							class="flex cursor-pointer items-center gap-2 rounded-lg border border-input p-2 text-xs transition-colors hover:bg-secondary/50 {focus === option.value ? 'border-primary bg-primary/10' : ''}"
						>
							<input type="radio" name="focus" value={option.value} bind:group={focus} class="sr-only" disabled={isAnalyzing} />
							<svelte:component this={option.icon} class="h-3 w-3" />
							<span>{option.label}</span>
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
					Analyzing...
				{:else}
					<Search class="h-4 w-4" />
					Analyze Repository
				{/if}
			</button>
		</form>
	</div>

	<!-- Observability Panel (shown during/after analysis) -->
	{#if isAnalyzing || events.length > 0}
		<div class="rounded-lg border border-border bg-background p-4 space-y-4">
			<!-- Header with Timer -->
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Activity class="h-5 w-5 text-primary" />
					<h4 class="font-semibold">Agent Activity</h4>
				</div>
				<div class="flex items-center gap-4 text-sm">
					<div class="flex items-center gap-1.5 text-muted-foreground">
						<Timer class="h-4 w-4" />
						<span class="font-mono">{formatTime(elapsedSeconds)}</span>
					</div>
					{#if isAnalyzing}
						<span class="flex items-center gap-1 text-green-500">
							<span class="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
							Live
						</span>
					{:else}
						<span class="text-muted-foreground">Completed</span>
					{/if}
				</div>
			</div>

			<!-- Phase Progress Bar -->
			<div class="space-y-2">
				<div class="flex justify-between text-xs text-muted-foreground">
					{#each phases as phase, i}
						{@const isActive = phase.id === currentPhase}
						{@const isComplete = getPhaseIndex(currentPhase) > i}
						<div class="flex flex-col items-center gap-1 {isActive ? 'text-primary' : isComplete ? 'text-green-500' : ''}">
							<svelte:component this={phase.icon} class="h-4 w-4" />
							<span class="text-[10px]">{phase.label}</span>
						</div>
					{/each}
				</div>
				<div class="h-1.5 rounded-full bg-secondary overflow-hidden">
					<div 
						class="h-full bg-primary transition-all duration-500"
						style="width: {((getPhaseIndex(currentPhase) + 1) / phases.length) * 100}%"
					></div>
				</div>
			</div>

			<!-- Metrics Grid -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
				<div class="rounded-lg bg-secondary/50 p-3">
					<div class="flex items-center gap-2 text-xs text-muted-foreground mb-1">
						<Brain class="h-3 w-3" />
						Iteration
					</div>
					<div class="text-lg font-semibold">{iteration}<span class="text-sm text-muted-foreground">/{maxIterations}</span></div>
				</div>
				<div class="rounded-lg bg-secondary/50 p-3">
					<div class="flex items-center gap-2 text-xs text-muted-foreground mb-1">
						<Wrench class="h-3 w-3" />
						Tool Calls
					</div>
					<div class="text-lg font-semibold">{toolCallsCount}</div>
				</div>
				<div class="rounded-lg bg-secondary/50 p-3">
					<div class="flex items-center gap-2 text-xs text-muted-foreground mb-1">
						<Code class="h-3 w-3" />
						Files
					</div>
					<div class="text-lg font-semibold">{filesAnalyzed || '—'}</div>
				</div>
				<div class="rounded-lg bg-secondary/50 p-3">
					<div class="flex items-center gap-2 text-xs text-muted-foreground mb-1">
						<BarChart3 class="h-3 w-3" />
						Est. Tokens
					</div>
					<div class="text-lg font-semibold">{Math.round(tokensEstimated).toLocaleString()}</div>
				</div>
			</div>

			<!-- Current Step -->
			{#if isAnalyzing && currentStep}
				<div class="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 p-3">
					<Loader2 class="h-4 w-4 animate-spin text-primary" />
					<span class="text-sm font-medium">{currentStep}</span>
				</div>
			{/if}

			<!-- Active Tools -->
			{#if activeTools.size > 0}
				<div class="space-y-2">
					<div class="text-xs font-medium text-muted-foreground">Active Tools</div>
					{#each [...activeTools.entries()] as [name, info]}
						<div class="flex items-center gap-2 rounded bg-yellow-500/10 border border-yellow-500/20 p-2 text-sm">
							<Loader2 class="h-3 w-3 animate-spin text-yellow-500" />
							<span class="font-mono text-xs">{name}</span>
							<span class="text-xs text-muted-foreground ml-auto">
								{Math.floor((Date.now() - info.startTime.getTime()) / 1000)}s
							</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Completed Tools -->
			{#if completedTools.length > 0}
				<div class="space-y-2">
					<div class="text-xs font-medium text-muted-foreground">Completed Tools ({completedTools.length})</div>
					<div class="max-h-32 overflow-y-auto space-y-1">
						{#each completedTools.slice(-5).reverse() as tool}
							<div class="flex items-center gap-2 rounded bg-secondary/50 p-2 text-xs">
								<CheckCircle class="h-3 w-3 text-green-500 flex-shrink-0" />
								<span class="font-mono">{tool.name}</span>
								<span class="text-muted-foreground ml-auto">{tool.duration}ms</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Event Log Toggle -->
			<button
				type="button"
				on:click={() => showFullLog = !showFullLog}
				class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
			>
				{#if showFullLog}
					<ChevronUp class="h-3 w-3" />
					Hide event log
				{:else}
					<ChevronDown class="h-3 w-3" />
					Show event log ({events.length} events)
				{/if}
			</button>

			<!-- Full Event Log -->
			{#if showFullLog}
				<div class="max-h-48 overflow-y-auto rounded bg-secondary/30 p-2 text-xs font-mono space-y-1">
					{#each events as event}
						<div class="flex gap-2 py-0.5 {event.type === 'error' ? 'text-destructive' : 'text-muted-foreground'}">
							<span class="text-[10px] opacity-50 w-16 flex-shrink-0">
								{event.timestamp.toLocaleTimeString()}
							</span>
							<span class="text-primary/70">[{event.type}]</span>
							<span class="flex-1">{event.message}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
