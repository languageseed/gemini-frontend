<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Bot, Sparkles, Github, FileText } from 'lucide-svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';
	import StatusIndicator from '$lib/components/StatusIndicator.svelte';
	import ApiKeyInput from '$lib/components/ApiKeyInput.svelte';
	import { messages, isLoading, error } from '$lib/stores/chat';
	import { api, type HealthResponse } from '$lib/utils/api';

	let health: HealthResponse | null = null;
	let connectionStatus: 'connected' | 'disconnected' | 'loading' = 'loading';
	let chatContainer: HTMLDivElement;

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
		const prompt = event.detail;

		// Add user message
		messages.addMessage({
			role: 'user',
			content: prompt
		});

		$isLoading = true;
		$error = null;

		try {
			const response = await api.agent({ prompt });

			messages.addMessage({
				role: 'assistant',
				content: response.text,
				toolCalls: response.tool_calls,
				iterations: response.iterations
			});
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
</script>

<svelte:head>
	<title>Gemini Agent | Hackathon</title>
</svelte:head>

<div class="flex h-screen flex-col">
	<!-- Header -->
	<header class="flex items-center justify-between border-b border-border px-6 py-4">
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
				<Sparkles class="h-5 w-5" />
			</div>
			<div>
				<h1 class="text-lg font-semibold">Gemini Agent</h1>
				<p class="text-xs text-muted-foreground">Powered by Gemini 3</p>
			</div>
		</div>

		<div class="flex items-center gap-3">
			<StatusIndicator
				status={connectionStatus}
				label="Backend"
				detail={health?.model || null}
			/>

			<ApiKeyInput secured={health?.secured ?? false} />

			<div class="flex gap-2">
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

	<!-- Chat Area -->
	<div bind:this={chatContainer} class="flex-1 overflow-y-auto">
		{#if $messages.length === 0}
			<!-- Empty State -->
			<div class="flex h-full flex-col items-center justify-center p-8 text-center">
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
					<Bot class="h-8 w-8 text-muted-foreground" />
				</div>
				<h2 class="mb-2 text-xl font-semibold">Welcome to Gemini Agent</h2>
				<p class="mb-6 max-w-md text-sm text-muted-foreground">
					Ask me anything! I can help with calculations, get the current time, search the web, and more.
				</p>
				<div class="flex flex-wrap justify-center gap-2">
					{#each ['What is 123 * 456?', 'What time is it?', 'Search for SvelteKit tutorials'] as suggestion}
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

				{#if $isLoading}
					<div class="flex gap-4 p-4">
						<div class="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
							<Bot class="h-4 w-4" />
						</div>
						<div class="flex items-center gap-2">
							<div class="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style="animation-delay: 0ms"></div>
							<div class="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style="animation-delay: 150ms"></div>
							<div class="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style="animation-delay: 300ms"></div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Input -->
	<ChatInput on:submit={handleSubmit} loading={$isLoading} disabled={connectionStatus !== 'connected'} />
</div>
