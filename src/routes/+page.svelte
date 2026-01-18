<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Bot, Sparkles, Github, FileText, Zap, Code, MessageSquare } from 'lucide-svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';
	import StatusIndicator from '$lib/components/StatusIndicator.svelte';
	import ApiKeyInput from '$lib/components/ApiKeyInput.svelte';
	import RepoAnalyzer from '$lib/components/RepoAnalyzer.svelte';
	import { messages, isLoading, error, currentSessionId } from '$lib/stores/chat';
	import { api, type HealthResponse } from '$lib/utils/api';

	let health: HealthResponse | null = null;
	let connectionStatus: 'connected' | 'disconnected' | 'loading' = 'loading';
	let chatContainer: HTMLDivElement;
	let activeTab: 'chat' | 'analyze' = 'chat';
	let isAnalyzing = false;

	onMount(async () => {
		try {
			health = await api.health();
			connectionStatus = 'connected';
		} catch (e) {
			connectionStatus = 'disconnected';
			toast.error('Failed to connect to backend');
		}
	});

	async function handleSubmit(event: CustomEvent<string>) {
		const task = event.detail;

		// Add user message
		messages.addMessage({
			role: 'user',
			content: task
		});

		$isLoading = true;
		$error = null;

		try {
			// Use v2 agent endpoint with session continuity
			const response = await api.agent({ 
				task,
				session_id: $currentSessionId 
			});

			// Update session ID for continuity
			if (response.session_id) {
				$currentSessionId = response.session_id;
			}

			messages.addMessage({
				role: 'assistant',
				content: response.text,
				toolCalls: response.tool_calls,
				iterations: response.iterations,
				sessionId: response.session_id,
				completed: response.completed
			});

			// Show warning if max iterations reached
			if (!response.completed) {
				toast.warning('Task may be incomplete - max iterations reached');
			}

			// Show error from agent if present
			if (response.error) {
				toast.error(response.error);
			}
		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : 'An error occurred';
			$error = errorMessage;
			toast.error(errorMessage);
		} finally {
			$isLoading = false;
		}

		// Scroll to bottom
		setTimeout(() => {
			chatContainer?.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
		}, 100);
	}

	function handleAnalyzeStart(event: CustomEvent<{ repo: string; focus: string }>) {
		// Analysis is handled in RepoAnalyzer with streaming - stay on analyze tab
		isAnalyzing = true;
	}

	function handleAnalyzeComplete(event: CustomEvent<{ analysis: string; toolCalls: any[]; iterations: number }>) {
		const { analysis, toolCalls, iterations } = event.detail;
		
		// Add the analysis result to chat history
		messages.addMessage({
			role: 'user',
			content: `Analyzed repository with focus on code quality`
		});
		
		messages.addMessage({
			role: 'assistant',
			content: analysis,
			toolCalls: toolCalls,
			iterations: iterations,
			completed: true
		});

		isAnalyzing = false;
		
		// Switch to chat tab to show full results
		activeTab = 'chat';
		
		toast.success(`Analysis complete in ${iterations} iterations`);

		// Scroll to bottom
		setTimeout(() => {
			chatContainer?.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
		}, 100);
	}

	function handleNewSession() {
		messages.clear();
		$currentSessionId = null;
		toast.success('Started new session');
	}
</script>

<svelte:head>
	<title>Marathon Agent | Gemini 3 Hackathon</title>
</svelte:head>

<div class="flex h-screen flex-col">
	<!-- Header -->
	<header class="flex items-center justify-between border-b border-border px-6 py-4">
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
				<Zap class="h-5 w-5" />
			</div>
			<div>
				<h1 class="text-lg font-semibold">Marathon Agent</h1>
				<p class="text-xs text-muted-foreground">
					{health?.version || 'v0.2.0'} • {health?.model || 'Gemini'}
				</p>
			</div>
		</div>

		<div class="flex items-center gap-3">
			<StatusIndicator
				status={connectionStatus}
				label="Backend"
				detail={health?.capabilities?.length ? `${health.capabilities.length} capabilities` : null}
			/>

			<ApiKeyInput secured={health?.secured ?? false} />

			<div class="flex gap-2">
				<button
					on:click={handleNewSession}
					class="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90"
				>
					<Sparkles class="h-4 w-4" />
					<span class="hidden sm:inline">New Session</span>
				</button>
				<a
					href="https://gemini-agent-hackathon-production.up.railway.app/docs"
					target="_blank"
					rel="noopener"
					class="inline-flex h-9 items-center gap-2 rounded-lg bg-secondary px-3 text-sm hover:bg-secondary/80"
				>
					<FileText class="h-4 w-4" />
					<span class="hidden sm:inline">API Docs</span>
				</a>
				<a
					href="https://github.com/languageseed/gemini-agent-hackathon"
					target="_blank"
					rel="noopener"
					class="inline-flex h-9 items-center gap-2 rounded-lg bg-secondary px-3 text-sm hover:bg-secondary/80"
				>
					<Github class="h-4 w-4" />
					<span class="hidden sm:inline">GitHub</span>
				</a>
			</div>
		</div>
	</header>

	<!-- Tabs -->
	<div class="flex gap-1 border-b border-border px-6">
		<button
			on:click={() => (activeTab = 'chat')}
			class="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			<MessageSquare class="h-4 w-4" />
			Chat
		</button>
		<button
			on:click={() => (activeTab = 'analyze')}
			class="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'analyze' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			<Code class="h-4 w-4" />
			Analyze Repo
			<span class="rounded bg-primary/20 px-1.5 py-0.5 text-xs">New</span>
		</button>
	</div>

	<!-- Content Area - Both tabs always mounted, CSS visibility toggle to preserve state -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Analyze Tab (always mounted) -->
		<div class="flex-1 overflow-y-auto p-6 {activeTab === 'analyze' ? '' : 'hidden'}">
			<div class="mx-auto max-w-2xl">
				<RepoAnalyzer on:analyze={handleAnalyzeStart} on:complete={handleAnalyzeComplete} />
			</div>
		</div>

		<!-- Chat Tab (always mounted) -->
		<div class="flex flex-1 flex-col overflow-hidden {activeTab === 'chat' ? '' : 'hidden'}">
			<div bind:this={chatContainer} class="flex-1 overflow-y-auto">
				{#if $messages.length === 0}
					<!-- Empty State -->
					<div class="flex h-full flex-col items-center justify-center p-8 text-center">
						<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
							<Zap class="h-8 w-8 text-muted-foreground" />
						</div>
						<h2 class="mb-2 text-xl font-semibold">Marathon Agent</h2>
						<p class="mb-6 max-w-md text-sm text-muted-foreground">
							I'm an autonomous agent that can execute multi-step tasks. 
							I can run code, do calculations, and work through complex problems step by step.
						</p>
						<div class="flex flex-wrap justify-center gap-2">
							{#each [
								'Calculate factorial of 10 and verify with code',
								'What is the current time?',
								'Write Python code to generate the first 20 Fibonacci numbers'
							] as suggestion}
								<button
									on:click={() => handleSubmit(new CustomEvent('submit', { detail: suggestion }))}
									class="rounded-full bg-secondary px-4 py-2 text-sm hover:bg-secondary/80"
								>
									{suggestion}
								</button>
							{/each}
						</div>
					</div>
				{:else}
					<!-- Messages -->
					<div class="divide-y divide-border">
						{#each $messages as message (message.id)}
							<ChatMessage {message} />
						{/each}

						{#if $isLoading || isAnalyzing}
							<div class="flex gap-4 p-4">
								<div class="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
									<Bot class="h-4 w-4" />
								</div>
								<div class="flex flex-col gap-1">
									<div class="flex items-center gap-2">
										<div class="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style="animation-delay: 0ms"></div>
										<div class="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style="animation-delay: 150ms"></div>
										<div class="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style="animation-delay: 300ms"></div>
									</div>
									{#if isAnalyzing}
										<span class="text-xs text-muted-foreground">Analyzing repository... this may take 1-2 minutes</span>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Input -->
			<ChatInput on:submit={handleSubmit} loading={$isLoading || isAnalyzing} disabled={connectionStatus !== 'connected'} />
		</div>
	</div>
</div>
