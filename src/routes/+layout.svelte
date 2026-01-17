<script lang="ts">
	import '../app.css';
	import { Toaster } from 'svelte-sonner';
</script>

<Toaster richColors position="top-right" />

<div class="flex min-h-screen flex-col">
	<slot />
</div>
