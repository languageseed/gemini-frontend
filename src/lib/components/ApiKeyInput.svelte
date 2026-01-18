<script lang="ts">
	import { Key, Eye, EyeOff } from 'lucide-svelte';
	import { api } from '$lib/utils/api';

	export let secured = false;

	let apiKey = '';
	let showKey = false;

	function handleInput() {
		if (apiKey.trim()) {
			api.setApiKey(apiKey.trim());
		} else {
			api.clearApiKey();
		}
	}
</script>

{#if secured}
	<form on:submit|preventDefault class="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
		<Key class="h-4 w-4 text-muted-foreground" />
		<input
			type={showKey ? 'text' : 'password'}
			bind:value={apiKey}
			on:input={handleInput}
			placeholder="Enter API key"
			autocomplete="off"
			class="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
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
