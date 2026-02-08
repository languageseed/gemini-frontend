<script lang="ts">
	import { Key, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-svelte';
	import { api } from '$lib/utils/api';
	import { onMount } from 'svelte';

	export let secured = false;

	let apiKey = '';
	let showKey = false;
	let hasKey = false;

	onMount(() => {
		// Check if we already have a key stored
		const existingKey = api.getApiKey();
		if (existingKey) {
			apiKey = existingKey;
			hasKey = true;
		}
	});

	function handleInput() {
		if (apiKey.trim()) {
			api.setApiKey(apiKey.trim());
			hasKey = true;
		} else {
			api.clearApiKey();
			hasKey = false;
		}
	}
</script>

{#if secured}
	<form on:submit|preventDefault class="flex items-center gap-2 rounded-lg border px-3 py-2 {hasKey ? 'border-green-500/50 bg-green-500/10' : 'border-yellow-500/50 bg-yellow-500/10 animate-pulse'}">
		{#if hasKey}
			<CheckCircle class="h-4 w-4 text-green-500" />
		{:else}
			<AlertCircle class="h-4 w-4 text-yellow-500" />
		{/if}
		<input
			type={showKey ? 'text' : 'password'}
			bind:value={apiKey}
			on:input={handleInput}
			placeholder={hasKey ? "API key set" : "⚠️ Enter API key to use"}
			autocomplete="off"
			class="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none w-32 sm:w-40"
		/>
		<button
			type="button"
			on:click={() => (showKey = !showKey)}
			class="text-muted-foreground hover:text-foreground"
		>
			{#if showKey}
				<EyeOff class="h-4 w-4" />
			{:else}
				<Eye class="h-4 w-4" />
			{/if}
		</button>
	</form>
{/if}
