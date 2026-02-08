<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { 
		Github, Search, Loader2, AlertCircle, CheckCircle, Code, Zap, 
		Shield, Bug, Layout, Clock, Activity, Brain, Wrench, 
		ChevronDown, ChevronUp, BarChart3, Timer, Beaker, XCircle,
		FileCode, FlaskConical, Play, CheckCheck
	} from 'lucide-svelte';
	import { api } from '$lib/utils/api';
	import AnalysisResults from './AnalysisResults.svelte';

	const dispatch = createEventDispatcher<{ 
		analyze: { repo: string; focus: string };
		complete: { analysis: string; toolCalls: any[]; iterations: number };
	}>();

	let repoUrl = '';
	let focus = 'all';
	let verifyFindings = true;
	let isAnalyzing = false;
	let error: string | null = null;
	
	// Pre-flight check state
	let backendConfig: { e2b_configured?: boolean; gemini_configured?: boolean } | null = null;
	let configWarning: string | null = null;
	let isSecured = false;
	let hasApiKey = false;
	
	function checkApiKey() {
		hasApiKey = api.hasApiKey();
	}
	
	// Results state
	let analysisResult: any = null;
	
	// Observability state
	let startTime: Date | null = null;
	let elapsedSeconds = 0;
	let elapsedInterval: ReturnType<typeof setInterval> | null = null;
	
	// Progress tracking
	let currentPhase = '';
	let currentStep = '';
	let issuesFound: any[] = [];
	let verifiedCount = 0;
	let unverifiedCount = 0;
	
	// Verification tracking
	let currentlyVerifying: string | null = null;
	let verificationLog: VerificationEntry[] = [];
	
	// Event log
	let events: ProgressEvent[] = [];
	let showFullLog = false;
	let showIssuesList = true;

	interface ProgressEvent {
		type: string;
		message: string;
		timestamp: Date;
		data?: any;
		phase?: string;
	}

	interface VerificationEntry {
		issueId: string;
		issueTitle: string;
		status: 'pending' | 'generating' | 'running' | 'verified' | 'unverified' | 'error';
		testCode?: string;
		output?: string;
		timestamp: Date;
	}

	const focusOptions = [
		{ value: 'all', label: 'Full Analysis', icon: Zap },
		{ value: 'bugs', label: 'Bug Detection', icon: Bug },
		{ value: 'security', label: 'Security Audit', icon: Shield },
		{ value: 'performance', label: 'Performance', icon: Zap },
		{ value: 'architecture', label: 'Architecture', icon: Layout },
	];

	const phases = [
		{ id: 'init', label: 'Init', icon: Zap },
		{ id: 'clone', label: 'Clone', icon: Github },
		{ id: 'analysis', label: 'Analyze', icon: Brain },
		{ id: 'extraction', label: 'Extract', icon: Code },
		{ id: 'verification', label: 'Verify', icon: Beaker },
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
		issuesFound = [];
		verifiedCount = 0;
		unverifiedCount = 0;
		currentPhase = 'init';
		currentStep = '';
		error = null;
		analysisResult = null;
		currentlyVerifying = null;
		verificationLog = [];
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
		
		addEvent('start', `Starting ${verifyFindings ? 'verified ' : ''}analysis of ${repoUrl}`, 'init');
		currentStep = 'Connecting to server...';

		try {
			const apiKey = api.getApiKey() || '';
			const baseUrl = import.meta.env.VITE_API_URL || 'https://gemini-agent-hackathon-production.up.railway.app';

			// Use V4 verified endpoint if enabled, otherwise V3
			const endpoint = verifyFindings 
				? `${baseUrl}/v4/analyze/verified/stream`
				: `${baseUrl}/v3/analyze/stream`;

			// Build headers - only include API key if present
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
					focus,
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
							
							// Handle V4 verified results vs V3 simple results
							if (event.issues) {
								// V4 verified result
								analysisResult = event;
								addEvent('done', `Analysis complete: ${event.total_issues} issues, ${event.verified_count} verified`, 'done');
							} else {
								// V3 simple result
								addEvent('done', `Analysis complete`, 'done');
								dispatch('complete', {
									analysis: event.analysis || '',
									toolCalls: event.tool_calls || [],
									iterations: event.iterations || 0,
								});
							}
							
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
			let errorMessage = e instanceof Error ? e.message : 'Analysis failed';
			
			// Detect Railway 5-minute timeout (ERR_HTTP2_PROTOCOL_ERROR or network error)
			const isNetworkError = errorMessage.toLowerCase().includes('network') || 
				errorMessage.toLowerCase().includes('failed to fetch') ||
				errorMessage.toLowerCase().includes('http2') ||
				(e instanceof TypeError && e.message === 'Failed to fetch');
			
			if (isNetworkError) {
				// Check if we have partial results
				const hasPartialResults = issuesFound > 0 || verifiedCount > 0;
				
				if (hasPartialResults) {
					errorMessage = `Connection timed out (Railway's 5-minute limit). Partial results shown: ${verifiedCount}/${issuesFound} verified. For longer analyses, try smaller repositories or use the async API.`;
				} else {
					errorMessage = 'Connection timed out (Railway has a 5-minute limit on HTTP requests). Try a smaller repository or use the async API: POST /v4/analyze/async';
				}
			}
			
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
				
				// Update phase-specific UI
				if (event.phase === 'verification') {
					currentPhase = 'verification';
				} else if (event.phase === 'extraction_complete') {
					addEvent('info', `Found ${event.count || issuesFound.length} issues to verify`, 'extraction');
				}
				break;
				
			case 'tool_start':
				currentStep = `Running: ${event.name}`;
				if (event.name === 'clone_repo') {
					currentPhase = 'clone';
					addEvent('tool', `Cloning repository...`, 'clone', event);
				} else if (event.name === 'verify_issue') {
					// Starting verification of an issue
					currentPhase = 'verification';
					currentlyVerifying = event.issue_id;
					const issueTitle = event.issue_title || event.issue_id;
					currentStep = `Verifying: ${issueTitle}`;
					
					// Add to verification log
					verificationLog = [...verificationLog, {
						issueId: event.issue_id,
						issueTitle: issueTitle,
						status: 'generating',
						timestamp: new Date(),
					}];
					
					addEvent('verify_start', `🧪 Generating test for: ${issueTitle}`, 'verification', event);
				} else if (event.name === 'generate_fix') {
					// Starting fix generation
					currentPhase = 'fix_generation';
					const fixTitle = event.issue_title || event.issue_id;
					currentStep = `Generating fix for: ${fixTitle}`;
					addEvent('fix_start', `🔧 Generating fix for: ${fixTitle}`, 'fix_generation', event);
				} else {
					addEvent('tool', `Started: ${event.name}`, undefined, event);
				}
				break;
				
			case 'tool_result':
				if (event.name === 'issue_found' && event.issue) {
					// New issue discovered
					issuesFound = [...issuesFound, event.issue];
					addEvent('issue', `🔍 Found: ${event.issue.title} [${event.issue.severity?.toUpperCase()}]`, 'extraction', event.issue);
				} else if (event.name === 'verify_issue') {
					// Verification result
					currentlyVerifying = null;
					
					// Update verification log entry
					verificationLog = verificationLog.map(entry => 
						entry.issueId === event.issue_id 
							? { ...entry, status: event.status, output: event.message }
							: entry
					);
					
					if (event.status === 'verified') {
						verifiedCount++;
						addEvent('verified', `✅ VERIFIED: ${event.issue_id} - Test failed as expected!`, 'verification');
					} else if (event.status === 'unverified') {
						unverifiedCount++;
						addEvent('unverified', `⚠️ Unverified: ${event.issue_id} - Test passed (may be false positive)`, 'verification');
					} else if (event.status === 'error') {
						addEvent('error', `❌ Error verifying ${event.issue_id}: ${event.message}`, 'verification');
					}
					
					// Update current step
					const remaining = issuesFound.length - verifiedCount - unverifiedCount;
					if (remaining > 0) {
						currentStep = `Verified ${verifiedCount + unverifiedCount}/${issuesFound.length} issues...`;
					} else {
						currentStep = 'Verification complete!';
					}
				} else if (event.name === 'clone_repo') {
					addEvent('result', `✓ Repository cloned successfully`, 'clone', event);
					currentPhase = 'analysis';
				} else if (event.name === 'generate_fix') {
					// Fix generation result
					if (event.status === 'success') {
						addEvent('fix_done', `✨ Fix generated: ${event.fix_description?.slice(0, 50)}...`, 'fix_generation');
					} else if (event.status === 'partial') {
						addEvent('fix_partial', `⚠️ Partial fix: ${event.message}`, 'fix_generation');
					} else if (event.status === 'error') {
						addEvent('fix_error', `❌ Fix error: ${event.message}`, 'fix_generation');
					}
				} else {
					addEvent('result', `Completed: ${event.name}`, undefined, event);
				}
				break;
				
			case 'token':
				currentStep = 'Generating analysis...';
				currentPhase = 'analysis';
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
		analysisResult = null;
		resetState();
	}

	// Pre-flight check on mount
	onMount(async () => {
		checkApiKey();
		const interval = setInterval(checkApiKey, 1000);
		
		try {
			const health = await api.health();
			backendConfig = health.config || null;
			isSecured = health.secured;
			
			// Warn if E2B not configured and verify is enabled
			if (backendConfig && !backendConfig.e2b_configured) {
				configWarning = "E2B sandbox not configured - verification will use limited fallback mode";
			}
		} catch (e) {
			// Health check failed - will show as disconnected in main UI
		}
		
		return () => clearInterval(interval);
	});
</script>

<div class="space-y-4">
	<!-- Show Results if available -->
	{#if analysisResult}
		<div class="mb-4">
			<button
				type="button"
				on:click={startNewAnalysis}
				class="text-sm text-primary hover:underline flex items-center gap-1"
			>
				← Analyze another repository
			</button>
		</div>
		<AnalysisResults result={analysisResult} />
	{:else}
		<!-- Input Card -->
		<div class="rounded-lg border border-border bg-secondary/30 p-6">
			<div class="mb-4 flex items-center gap-2">
				<Github class="h-5 w-5" />
				<h3 class="text-lg font-semibold">Codebase Analyst</h3>
				<span class="rounded bg-primary/20 px-2 py-0.5 text-xs text-primary">V2</span>
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

				<!-- Verify Toggle -->
				<div class="flex items-center justify-between rounded-lg border border-border bg-background p-3">
					<div class="flex items-center gap-2">
						<Beaker class="h-4 w-4 text-green-400" />
						<div>
							<div class="text-sm font-medium">Verify Findings</div>
							<div class="text-xs text-muted-foreground">Generate and run tests to confirm bugs</div>
						</div>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input type="checkbox" bind:checked={verifyFindings} class="sr-only peer" disabled={isAnalyzing} />
						<div class="w-11 h-6 bg-secondary rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
					</label>
				</div>

				<!-- API Key Warning -->
				{#if isSecured && !hasApiKey}
					<div class="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 text-sm text-yellow-400">
						<AlertCircle class="h-4 w-4" />
						<div>
							<span class="font-medium">API Key Required</span> — Enter your API key in the header above.
						</div>
					</div>
				{/if}

				<!-- Config Warning -->
				{#if configWarning && verifyFindings && hasApiKey}
					<div class="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm text-yellow-400">
						<AlertCircle class="h-4 w-4" />
						{configWarning}
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
					disabled={isAnalyzing || !repoUrl.trim() || (isSecured && !hasApiKey)}
					class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if isAnalyzing}
						<Loader2 class="h-4 w-4 animate-spin" />
						Analyzing...
					{:else if isSecured && !hasApiKey}
						<AlertCircle class="h-4 w-4" />
						Enter API Key Above
					{:else}
						<Search class="h-4 w-4" />
						{verifyFindings ? 'Analyze & Verify' : 'Analyze Repository'}
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
						<Bug class="h-3 w-3" />
						Issues Found
					</div>
					<div class="text-lg font-semibold">{issuesFound.length}</div>
				</div>
				<div class="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
					<div class="flex items-center gap-2 text-xs text-muted-foreground mb-1">
						<CheckCircle class="h-3 w-3 text-green-400" />
						Verified
					</div>
					<div class="text-lg font-semibold text-green-400">{verifiedCount}</div>
				</div>
				<div class="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
					<div class="flex items-center gap-2 text-xs text-muted-foreground mb-1">
						<XCircle class="h-3 w-3 text-yellow-400" />
						Unverified
					</div>
					<div class="text-lg font-semibold text-yellow-400">{unverifiedCount}</div>
				</div>
				<div class="rounded-lg bg-secondary/50 p-3">
					<div class="flex items-center gap-2 text-xs text-muted-foreground mb-1">
						<Clock class="h-3 w-3" />
						Elapsed
					</div>
					<div class="text-lg font-semibold">{formatTime(elapsedSeconds)}</div>
				</div>
			</div>

			<!-- Current Step -->
			{#if isAnalyzing && currentStep}
				<div class="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 p-3">
					<Loader2 class="h-4 w-4 animate-spin text-primary" />
					<span class="text-sm font-medium">{currentStep}</span>
				</div>
			{/if}

			<!-- Live Issues List -->
			{#if issuesFound.length > 0}
				<div class="space-y-2">
					<button
						type="button"
						on:click={() => showIssuesList = !showIssuesList}
						class="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
					>
						{#if showIssuesList}
							<ChevronUp class="h-3 w-3" />
						{:else}
							<ChevronDown class="h-3 w-3" />
						{/if}
						Issues Found ({issuesFound.length})
					</button>
					
					{#if showIssuesList}
						<div class="space-y-1 max-h-48 overflow-y-auto">
							{#each issuesFound as issue, i}
								{@const verifyEntry = verificationLog.find(v => v.issueId === issue.id)}
								{@const isCurrentlyVerifying = currentlyVerifying === issue.id}
								<div class="flex items-center gap-2 rounded bg-secondary/30 p-2 text-xs {isCurrentlyVerifying ? 'ring-1 ring-primary' : ''}">
									<!-- Severity Badge -->
									<span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase
										{issue.severity === 'critical' ? 'bg-red-500 text-white' : 
										 issue.severity === 'high' ? 'bg-orange-500 text-white' : 
										 issue.severity === 'medium' ? 'bg-yellow-500 text-black' : 
										 'bg-gray-500 text-white'}">
										{issue.severity?.slice(0, 4) || 'MED'}
									</span>
									
									<!-- Issue Title -->
									<span class="flex-1 truncate" title={issue.title}>
										{issue.title}
									</span>
									
									<!-- Verification Status -->
									<span class="shrink-0 flex items-center gap-1">
										{#if isCurrentlyVerifying}
											<Loader2 class="h-3 w-3 animate-spin text-primary" />
											<span class="text-primary">Testing...</span>
										{:else if verifyEntry?.status === 'verified'}
											<CheckCircle class="h-3 w-3 text-green-400" />
											<span class="text-green-400">Verified</span>
										{:else if verifyEntry?.status === 'unverified'}
											<XCircle class="h-3 w-3 text-yellow-400" />
											<span class="text-yellow-400">Unverified</span>
										{:else if verifyEntry?.status === 'error'}
											<AlertCircle class="h-3 w-3 text-red-400" />
											<span class="text-red-400">Error</span>
										{:else if currentPhase === 'verification'}
											<Clock class="h-3 w-3 text-muted-foreground" />
											<span class="text-muted-foreground">Pending</span>
										{:else}
											<span class="text-muted-foreground">—</span>
										{/if}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Verification Progress -->
			{#if currentPhase === 'verification' && verificationLog.length > 0}
				<div class="space-y-2">
					<div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
						<FlaskConical class="h-3 w-3" />
						Verification Progress
					</div>
					<div class="rounded bg-secondary/30 p-2 space-y-1 max-h-32 overflow-y-auto">
						{#each verificationLog as entry}
							<div class="flex items-center gap-2 text-xs">
								{#if entry.status === 'generating'}
									<Loader2 class="h-3 w-3 animate-spin text-blue-400" />
									<span class="text-blue-400">Generating test...</span>
								{:else if entry.status === 'running'}
									<Play class="h-3 w-3 text-purple-400" />
									<span class="text-purple-400">Running test...</span>
								{:else if entry.status === 'verified'}
									<CheckCheck class="h-3 w-3 text-green-400" />
									<span class="text-green-400">✓ Bug confirmed!</span>
								{:else if entry.status === 'unverified'}
									<XCircle class="h-3 w-3 text-yellow-400" />
									<span class="text-yellow-400">Test passed</span>
								{:else if entry.status === 'error'}
									<AlertCircle class="h-3 w-3 text-red-400" />
									<span class="text-red-400">Error</span>
								{/if}
								<span class="flex-1 truncate text-muted-foreground">{entry.issueTitle}</span>
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
						<div class="flex gap-2 py-0.5 
							{event.type === 'error' ? 'text-destructive' : 
							 event.type === 'verified' ? 'text-green-400' : 
							 event.type === 'unverified' ? 'text-yellow-400' :
							 event.type === 'issue' ? 'text-orange-400' : 
							 event.type === 'verify_start' ? 'text-blue-400' :
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
