<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { 
		Github, Search, Loader2, AlertCircle, CheckCircle, Code, Zap, 
		Shield, Bug, Layout, Clock, Activity, Brain, Wrench, 
		ChevronDown, ChevronUp, BarChart3, Timer, Beaker, XCircle,
		FileCode, FlaskConical, Play, CheckCheck, Heart, TrendingUp,
		Lock, Lightbulb, RefreshCw, Gauge, AlertTriangle
	} from 'lucide-svelte';
	import { api } from '$lib/utils/api';

	const dispatch = createEventDispatcher<{ 
		complete: { result: any };
	}>();

	let repoUrl = '';
	let evolutionFocus = 'full';
	let runSecurityScan = true;
	let runCodeAnalysis = true;
	let runEvolutionAnalysis = true;
	let isAnalyzing = false;
	let error: string | null = null;
	
	// Results state
	let result: any = null;
	
	// Observability state
	let startTime: Date | null = null;
	let elapsedSeconds = 0;
	let elapsedInterval: ReturnType<typeof setInterval> | null = null;
	
	// Progress tracking
	let currentPhase = '';
	let currentStep = '';
	
	// Counts
	let securityFindings: any[] = [];
	let codeIssues: any[] = [];
	let evolutionRecs: any[] = [];
	
	// Event log
	let events: ProgressEvent[] = [];
	let showFullLog = false;
	let activeResultTab: 'security' | 'issues' | 'evolution' | 'summary' = 'summary';

	interface ProgressEvent {
		type: string;
		message: string;
		timestamp: Date;
		data?: any;
		phase?: string;
	}

	const evolutionFocusOptions = [
		{ value: 'full', label: 'Full Analysis', icon: Zap },
		{ value: 'architecture', label: 'Architecture', icon: Layout },
		{ value: 'security', label: 'Security', icon: Shield },
		{ value: 'performance', label: 'Performance', icon: Zap },
		{ value: 'testing', label: 'Testing', icon: Beaker },
		{ value: 'debt', label: 'Tech Debt', icon: RefreshCw },
	];

	const phases = [
		{ id: 'init', label: 'Init', icon: Zap },
		{ id: 'clone', label: 'Clone', icon: Github },
		{ id: 'security', label: 'Security', icon: Shield },
		{ id: 'analysis', label: 'Analysis', icon: Brain },
		{ id: 'evolution', label: 'Evolution', icon: TrendingUp },
		{ id: 'done', label: 'Done', icon: CheckCircle },
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
		securityFindings = [];
		codeIssues = [];
		evolutionRecs = [];
		currentPhase = 'init';
		currentStep = '';
		error = null;
		result = null;
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
		
		addEvent('start', `Starting Code Doctor analysis of ${repoUrl}`, 'init');
		currentStep = 'Connecting to server...';

		try {
			const apiKey = api.getApiKey() || '';
			const baseUrl = import.meta.env.VITE_API_URL || 'https://gemini-agent-hackathon-production.up.railway.app';
			const endpoint = `${baseUrl}/v5/analyze/full/stream`;

			const headers: Record<string, string> = {
				'Content-Type': 'application/json',
			};
			if (apiKey) {
				headers['X-API-Key'] = apiKey;
			}

			const response = await fetch(endpoint, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					repo_url: repoUrl.trim(),
					run_security_scan: runSecurityScan,
					run_code_analysis: runCodeAnalysis,
					run_evolution_analysis: runEvolutionAnalysis,
					evolution_focus: evolutionFocus,
					max_issues_to_verify: 10,
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
							result = event;
							
							// Populate result arrays
							securityFindings = event.security_findings || [];
							codeIssues = event.code_issues || [];
							evolutionRecs = event.evolution_recommendations || [];
							
							addEvent('done', `Analysis complete! Health score: ${Math.round(event.overall_health_score || 0)}`, 'done');
							isAnalyzing = false;
							
							dispatch('complete', { result: event });
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
			case 'thinking':
				currentPhase = event.phase || currentPhase;
				currentStep = event.message || `Phase: ${event.phase}`;
				addEvent('thinking', event.message || event.phase, event.phase);
				break;
				
			case 'tool_start':
				currentStep = `Running: ${event.phase || event.name || 'processing'}`;
				if (event.phase === 'clone') {
					currentPhase = 'clone';
					addEvent('tool', `Cloning repository...`, 'clone', event);
				} else if (event.phase === 'security') {
					currentPhase = 'security';
					addEvent('tool', `Scanning for secrets...`, 'security', event);
				} else if (event.phase === 'analysis') {
					currentPhase = 'analysis';
					addEvent('tool', `Analyzing code...`, 'analysis', event);
				} else if (event.phase === 'evolution') {
					currentPhase = 'evolution';
					addEvent('tool', `Generating recommendations...`, 'evolution', event);
				}
				break;
				
			case 'tool_result':
				if (event.type === 'security_finding' && event.finding) {
					securityFindings = [...securityFindings, event.finding];
					addEvent('security', `🔒 ${event.finding.title}`, 'security', event.finding);
				} else if (event.type === 'issue' && event.issue) {
					codeIssues = [...codeIssues, event.issue];
					addEvent('issue', `🐛 ${event.issue.title}`, 'analysis', event.issue);
				} else if (event.type === 'recommendation_found' && event.recommendation) {
					evolutionRecs = [...evolutionRecs, event.recommendation];
					addEvent('evolution', `💡 ${event.recommendation.title}`, 'evolution', event.recommendation);
				}
				break;
				
			case 'token':
				currentStep = 'Generating analysis...';
				break;
				
			case 'heartbeat':
				break;
		}
	}

	function setExample(url: string) {
		repoUrl = url;
	}

	function getPhaseIndex(phase: string): number {
		return phases.findIndex(p => p.id === phase);
	}

	function startNewAnalysis() {
		result = null;
		resetState();
	}

	function getHealthColor(score: number): string {
		if (score >= 80) return 'text-green-400';
		if (score >= 60) return 'text-yellow-400';
		if (score >= 40) return 'text-orange-400';
		return 'text-red-400';
	}

	function getHealthBg(score: number): string {
		if (score >= 80) return 'bg-green-500/20 border-green-500/30';
		if (score >= 60) return 'bg-yellow-500/20 border-yellow-500/30';
		if (score >= 40) return 'bg-orange-500/20 border-orange-500/30';
		return 'bg-red-500/20 border-red-500/30';
	}

	function getSeverityColor(severity: string): string {
		switch (severity?.toLowerCase()) {
			case 'critical': return 'bg-red-500 text-white';
			case 'high': return 'bg-orange-500 text-white';
			case 'medium': return 'bg-yellow-500 text-black';
			case 'low': return 'bg-gray-500 text-white';
			default: return 'bg-gray-500 text-white';
		}
	}

	function getPriorityColor(priority: string): string {
		switch (priority?.toLowerCase()) {
			case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
			case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
			case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
			case 'low': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
			default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
		}
	}

	function getEffortIcon(effort: string) {
		switch (effort?.toLowerCase()) {
			case 'trivial': return '⚡';
			case 'small': return '🔧';
			case 'medium': return '📋';
			case 'large': return '🏗️';
			case 'epic': return '🚀';
			default: return '📋';
		}
	}
</script>

<div class="space-y-4">
	<!-- Show Results if available -->
	{#if result}
		<div class="mb-4">
			<button
				type="button"
				on:click={startNewAnalysis}
				class="text-sm text-primary hover:underline flex items-center gap-1"
			>
				← Analyze another repository
			</button>
		</div>

		<!-- Health Score Hero -->
		<div class="rounded-lg border {getHealthBg(result.overall_health_score || 0)} p-6 text-center">
			<div class="flex items-center justify-center gap-2 mb-2">
				<Heart class="h-6 w-6 {getHealthColor(result.overall_health_score || 0)}" />
				<span class="text-sm text-muted-foreground">Overall Health Score</span>
			</div>
			<div class="text-5xl font-bold {getHealthColor(result.overall_health_score || 0)}">
				{Math.round(result.overall_health_score || 0)}
			</div>
			<div class="text-sm text-muted-foreground mt-1">out of 100</div>
			{#if result.evolution_summary?.maturity_level}
				<div class="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
					<Gauge class="h-3 w-3" />
					{result.evolution_summary.maturity_level} maturity
				</div>
			{/if}
		</div>

		<!-- Summary Cards -->
		<div class="grid grid-cols-3 gap-3">
			<button
				type="button"
				on:click={() => activeResultTab = 'security'}
				class="rounded-lg border p-4 text-left transition-colors {activeResultTab === 'security' ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50'}"
			>
				<div class="flex items-center gap-2 mb-2">
					<Shield class="h-4 w-4 text-red-400" />
					<span class="text-sm font-medium">Security</span>
				</div>
				<div class="text-2xl font-bold">{result.security_summary?.total || 0}</div>
				<div class="text-xs text-muted-foreground">
					{result.security_summary?.critical || 0} critical
				</div>
			</button>

			<button
				type="button"
				on:click={() => activeResultTab = 'issues'}
				class="rounded-lg border p-4 text-left transition-colors {activeResultTab === 'issues' ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50'}"
			>
				<div class="flex items-center gap-2 mb-2">
					<Bug class="h-4 w-4 text-orange-400" />
					<span class="text-sm font-medium">Code Issues</span>
				</div>
				<div class="text-2xl font-bold">{result.code_summary?.total || 0}</div>
				<div class="text-xs text-muted-foreground">
					{result.code_summary?.verified || 0} verified bugs
				</div>
			</button>

			<button
				type="button"
				on:click={() => activeResultTab = 'evolution'}
				class="rounded-lg border p-4 text-left transition-colors {activeResultTab === 'evolution' ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50'}"
			>
				<div class="flex items-center gap-2 mb-2">
					<TrendingUp class="h-4 w-4 text-green-400" />
					<span class="text-sm font-medium">Evolution</span>
				</div>
				<div class="text-2xl font-bold">{result.evolution_summary?.total || 0}</div>
				<div class="text-xs text-muted-foreground">
					{result.evolution_summary?.quick_wins || 0} quick wins
				</div>
			</button>
		</div>

		<!-- Result Details -->
		<div class="rounded-lg border border-border bg-background p-4">
			<!-- Tab Content -->
			{#if activeResultTab === 'summary'}
				<div class="prose prose-invert prose-sm max-w-none">
					<h3 class="flex items-center gap-2 text-lg font-semibold mb-4">
						<FileCode class="h-5 w-5" />
						Executive Summary
					</h3>
					{@html result.executive_summary?.replace(/\n/g, '<br/>') || 'No summary available'}
				</div>

			{:else if activeResultTab === 'security'}
				<h3 class="flex items-center gap-2 text-lg font-semibold mb-4">
					<Shield class="h-5 w-5 text-red-400" />
					Security Findings ({securityFindings.length})
				</h3>
				{#if securityFindings.length === 0}
					<div class="text-center py-8 text-muted-foreground">
						<CheckCircle class="h-12 w-12 mx-auto mb-2 text-green-400" />
						<p>No security issues detected!</p>
					</div>
				{:else}
					<div class="space-y-2 max-h-96 overflow-y-auto">
						{#each securityFindings as finding}
							<div class="rounded-lg border border-border bg-secondary/30 p-3">
								<div class="flex items-start gap-2">
									<span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase {getSeverityColor(finding.severity)}">
										{finding.severity}
									</span>
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm">{finding.title}</div>
										<div class="text-xs text-muted-foreground mt-1">{finding.file_path}:{finding.line_number || '?'}</div>
										{#if finding.evidence}
											<code class="block mt-2 p-2 rounded bg-secondary text-xs overflow-x-auto">{finding.evidence}</code>
										{/if}
										{#if finding.recommendation}
											<div class="mt-2 text-xs text-green-400">
												💡 {finding.recommendation}
											</div>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}

			{:else if activeResultTab === 'issues'}
				<h3 class="flex items-center gap-2 text-lg font-semibold mb-4">
					<Bug class="h-5 w-5 text-orange-400" />
					Code Issues ({codeIssues.length})
				</h3>
				{#if codeIssues.length === 0}
					<div class="text-center py-8 text-muted-foreground">
						<CheckCircle class="h-12 w-12 mx-auto mb-2 text-green-400" />
						<p>No code issues detected!</p>
					</div>
				{:else}
					<div class="space-y-2 max-h-96 overflow-y-auto">
						{#each codeIssues as issue}
							<div class="rounded-lg border border-border bg-secondary/30 p-3">
								<div class="flex items-start gap-2">
									<span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase {getSeverityColor(issue.severity)}">
										{issue.severity}
									</span>
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<span class="font-medium text-sm">{issue.title}</span>
											{#if issue.verification_status === 'verified'}
												<span class="flex items-center gap-1 text-xs text-green-400">
													<CheckCheck class="h-3 w-3" />
													Verified
												</span>
											{:else if issue.verification_status === 'unverified'}
												<span class="flex items-center gap-1 text-xs text-yellow-400">
													<AlertTriangle class="h-3 w-3" />
													Unverified
												</span>
											{/if}
										</div>
										<div class="text-xs text-muted-foreground mt-1">{issue.file_path}:{issue.line_number || '?'}</div>
										<div class="text-xs mt-2 text-muted-foreground">{issue.description}</div>
										{#if issue.fix_code && issue.fix_status === 'proposed'}
											<div class="mt-2 rounded bg-green-500/10 border border-green-500/20 p-2">
												<div class="text-xs text-green-400 mb-1">🔧 Proposed Fix:</div>
												<code class="block text-xs overflow-x-auto">{issue.fix_code}</code>
											</div>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}

			{:else if activeResultTab === 'evolution'}
				<h3 class="flex items-center gap-2 text-lg font-semibold mb-4">
					<TrendingUp class="h-5 w-5 text-green-400" />
					Evolution Recommendations ({evolutionRecs.length})
				</h3>
				{#if evolutionRecs.length === 0}
					<div class="text-center py-8 text-muted-foreground">
						<Lightbulb class="h-12 w-12 mx-auto mb-2" />
						<p>No recommendations generated</p>
					</div>
				{:else}
					<div class="space-y-3 max-h-96 overflow-y-auto">
						{#each evolutionRecs as rec}
							<div class="rounded-lg border border-border bg-secondary/30 p-3">
								<div class="flex items-start gap-3">
									<div class="text-2xl">{getEffortIcon(rec.effort)}</div>
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 flex-wrap">
											<span class="font-medium text-sm">{rec.title}</span>
											<span class="rounded-full border px-2 py-0.5 text-[10px] {getPriorityColor(rec.priority)}">
												{rec.priority}
											</span>
											<span class="text-[10px] text-muted-foreground">
												{rec.effort} effort
											</span>
										</div>
										<div class="text-xs text-muted-foreground mt-1">{rec.category}</div>
										<div class="text-xs mt-2">{rec.description}</div>
										{#if rec.implementation_steps?.length > 0}
											<details class="mt-2">
												<summary class="text-xs text-primary cursor-pointer">Implementation steps</summary>
												<ol class="mt-1 text-xs text-muted-foreground list-decimal list-inside space-y-1">
													{#each rec.implementation_steps as step}
														<li>{step}</li>
													{/each}
												</ol>
											</details>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

	{:else}
		<!-- Input Card -->
		<div class="rounded-lg border border-border bg-secondary/30 p-6">
			<div class="mb-4 flex items-center gap-2">
				<Heart class="h-5 w-5 text-primary" />
				<h3 class="text-lg font-semibold">Code Doctor</h3>
				<span class="rounded bg-green-500/20 px-2 py-0.5 text-xs text-green-400">New</span>
			</div>

			<p class="text-sm text-muted-foreground mb-4">
				Comprehensive codebase health check: security scan, bug detection with verification, and evolution roadmap.
			</p>

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

				<!-- Analysis Toggles -->
				<div class="grid grid-cols-3 gap-3">
					<label class="flex items-center gap-2 rounded-lg border p-3 cursor-pointer {runSecurityScan ? 'border-primary bg-primary/10' : 'border-border'}">
						<input type="checkbox" bind:checked={runSecurityScan} class="sr-only" disabled={isAnalyzing} />
						<Shield class="h-4 w-4 {runSecurityScan ? 'text-primary' : 'text-muted-foreground'}" />
						<span class="text-sm">Security</span>
					</label>
					<label class="flex items-center gap-2 rounded-lg border p-3 cursor-pointer {runCodeAnalysis ? 'border-primary bg-primary/10' : 'border-border'}">
						<input type="checkbox" bind:checked={runCodeAnalysis} class="sr-only" disabled={isAnalyzing} />
						<Bug class="h-4 w-4 {runCodeAnalysis ? 'text-primary' : 'text-muted-foreground'}" />
						<span class="text-sm">Code</span>
					</label>
					<label class="flex items-center gap-2 rounded-lg border p-3 cursor-pointer {runEvolutionAnalysis ? 'border-primary bg-primary/10' : 'border-border'}">
						<input type="checkbox" bind:checked={runEvolutionAnalysis} class="sr-only" disabled={isAnalyzing} />
						<TrendingUp class="h-4 w-4 {runEvolutionAnalysis ? 'text-primary' : 'text-muted-foreground'}" />
						<span class="text-sm">Evolution</span>
					</label>
				</div>

				<!-- Evolution Focus (if enabled) -->
				{#if runEvolutionAnalysis}
					<div>
						<span class="mb-2 block text-sm font-medium">Evolution Focus</span>
						<div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
							{#each evolutionFocusOptions as option}
								<label
									class="flex cursor-pointer items-center gap-1 rounded-lg border border-input p-2 text-xs transition-colors hover:bg-secondary/50 {evolutionFocus === option.value ? 'border-primary bg-primary/10' : ''}"
								>
									<input type="radio" name="evolutionFocus" value={option.value} bind:group={evolutionFocus} class="sr-only" disabled={isAnalyzing} />
									<svelte:component this={option.icon} class="h-3 w-3" />
									<span class="hidden sm:inline">{option.label}</span>
								</label>
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
						Running Health Check...
					{:else}
						<Heart class="h-4 w-4" />
						Run Code Doctor
					{/if}
				</button>
			</form>
		</div>

		<!-- Observability Panel (shown during analysis) -->
		{#if isAnalyzing || events.length > 0}
			<div class="rounded-lg border border-border bg-background p-4 space-y-4">
				<!-- Header with Timer -->
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Activity class="h-5 w-5 text-primary" />
						<h4 class="font-semibold">Analysis Progress</h4>
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
				<div class="grid grid-cols-3 gap-3">
					<div class="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
						<div class="flex items-center gap-2 text-xs text-muted-foreground mb-1">
							<Shield class="h-3 w-3 text-red-400" />
							Security
						</div>
						<div class="text-lg font-semibold text-red-400">{securityFindings.length}</div>
					</div>
					<div class="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3">
						<div class="flex items-center gap-2 text-xs text-muted-foreground mb-1">
							<Bug class="h-3 w-3 text-orange-400" />
							Issues
						</div>
						<div class="text-lg font-semibold text-orange-400">{codeIssues.length}</div>
					</div>
					<div class="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
						<div class="flex items-center gap-2 text-xs text-muted-foreground mb-1">
							<Lightbulb class="h-3 w-3 text-green-400" />
							Ideas
						</div>
						<div class="text-lg font-semibold text-green-400">{evolutionRecs.length}</div>
					</div>
				</div>

				<!-- Current Step -->
				{#if isAnalyzing && currentStep}
					<div class="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 p-3">
						<Loader2 class="h-4 w-4 animate-spin text-primary" />
						<span class="text-sm font-medium">{currentStep}</span>
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
							<div class="flex gap-2 py-0.5 
								{event.type === 'error' ? 'text-destructive' : 
								 event.type === 'security' ? 'text-red-400' : 
								 event.type === 'issue' ? 'text-orange-400' :
								 event.type === 'evolution' ? 'text-green-400' : 
								 'text-muted-foreground'}">
								<span class="text-[10px] opacity-50 w-16 flex-shrink-0">
									{event.timestamp.toLocaleTimeString()}
								</span>
								<span class="flex-1">{event.message}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
