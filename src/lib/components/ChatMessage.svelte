<script lang="ts">
	import { Zap, User, Wrench, CheckCircle, AlertCircle } from 'lucide-svelte';
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
			<Zap class="h-4 w-4" />
		{/if}
	</div>

	<div class="flex-1 space-y-2 overflow-hidden">
		<div class="flex items-center gap-2">
			<span class="text-sm font-medium">
				{message.role === 'user' ? 'You' : 'Marathon Agent'}
			</span>
			<span class="text-xs text-muted-foreground">
				{message.timestamp.toLocaleTimeString()}
			</span>
			{#if message.role === 'assistant' && message.completed !== undefined}
				{#if message.completed}
					<CheckCircle class="h-3 w-3 text-green-500" />
				{:else}
					<AlertCircle class="h-3 w-3 text-yellow-500" />
				{/if}
			{/if}
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
					<span>Tools used ({message.toolCalls.length}):</span>
				</div>
				<div class="flex flex-wrap gap-1">
					{#each message.toolCalls as tool}
						<span class="rounded bg-secondary px-2 py-0.5 text-xs font-mono" title={JSON.stringify(tool.arguments, null, 2)}>
							{tool.name}
						</span>
					{/each}
				</div>
			</div>
		{/if}

		{#if message.iterations && message.iterations > 0}
			<div class="text-xs text-muted-foreground">
				{message.completed ? 'Completed' : 'Processed'} in {message.iterations} iteration{message.iterations > 1 ? 's' : ''}
			</div>
		{/if}
	</div>
</div>
