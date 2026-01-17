<script lang="ts">
	import { Send, Loader2 } from 'lucide-svelte';
	import { createEventDispatcher } from 'svelte';

	export let disabled = false;
	export let loading = false;
	export let placeholder = 'Ask the Gemini Agent...';

	let value = '';
	const dispatch = createEventDispatcher<{ submit: string }>();

	function handleSubmit() {
		if (!value.trim() || disabled || loading) return;
		dispatch('submit', value.trim());
		value = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

<form on:submit|preventDefault={handleSubmit} class="flex gap-2 border-t border-border bg-background p-4">
	<div class="relative flex-1">
		<textarea
			bind:value
			on:keydown={handleKeydown}
			{placeholder}
			disabled={disabled || loading}
			rows="1"
			class="w-full resize-none rounded-lg border border-input bg-secondary px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
		></textarea>
	</div>

	<button
		type="submit"
		disabled={!value.trim() || disabled || loading}
		class="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
	>
		{#if loading}
			<Loader2 class="h-5 w-5 animate-spin" />
		{:else}
			<Send class="h-5 w-5" />
		{/if}
	</button>
</form>
