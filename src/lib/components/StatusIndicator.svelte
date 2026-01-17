<script lang="ts">
	import { CheckCircle, XCircle, Loader2 } from 'lucide-svelte';

	export let status: 'connected' | 'disconnected' | 'loading' = 'loading';
	export let label: string;
	export let detail: string | null = null;
</script>

<div class="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2">
	{#if status === 'loading'}
		<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
	{:else if status === 'connected'}
		<CheckCircle class="h-4 w-4 text-green-500" />
	{:else}
		<XCircle class="h-4 w-4 text-destructive" />
	{/if}

	<div class="flex flex-col">
		<span class="text-xs font-medium">{label}</span>
		{#if detail}
			<span class="text-xs text-muted-foreground">{detail}</span>
		{/if}
	</div>
</div>
