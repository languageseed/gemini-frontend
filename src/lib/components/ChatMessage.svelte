<script lang="ts">
	import { Bot, User, Wrench } from 'lucide-svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import type { Message } from '$lib/stores/chat';

	export let message: Message;

	$: htmlContent = message.role === 'assistant' ? renderMarkdown(message.content) : message.content;
</script>

<div class="flex gap-4 p-4 {message.role === 'user' ? 'bg-secondary/50' : ''}">
	<div
		class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {message.role === 'user'
			? 'bg-primary'
			: 'bg-accent'}"
	>
		{#if message.role === 'user'}
			<User class="h-4 w-4" />
		{:else}
			<Bot class="h-4 w-4" />
		{/if}
	</div>

	<div class="flex-1 space-y-2 overflow-hidden">
		<div class="flex items-center gap-2">
			<span class="text-sm font-medium">
				{message.role === 'user' ? 'You' : 'Gemini Agent'}
			</span>
			<span class="text-xs text-muted-foreground">
				{message.timestamp.toLocaleTimeString()}
			</span>
		</div>

		{#if message.role === 'assistant'}
			<div class="prose-chat">
				{@html htmlContent}
			</div>
		{:else}
			<p class="text-sm">{message.content}</p>
		{/if}

		{#if message.toolCalls && message.toolCalls.length > 0}
			<div class="mt-2 space-y-1">
				<div class="flex items-center gap-1 text-xs text-muted-foreground">
					<Wrench class="h-3 w-3" />
					<span>Tools used:</span>
				</div>
				<div class="flex flex-wrap gap-1">
					{#each message.toolCalls as tool}
						<span class="rounded bg-secondary px-2 py-0.5 text-xs font-mono">
							{tool.name}
						</span>
					{/each}
				</div>
			</div>
		{/if}

		{#if message.iterations && message.iterations > 1}
			<div class="text-xs text-muted-foreground">
				Completed in {message.iterations} iterations
			</div>
		{/if}
	</div>
</div>
