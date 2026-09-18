<script lang="ts">
	import { api } from '$lib/api';
	import { onMount } from 'svelte';

	let token = localStorage.getItem('recycle_token') ?? '';
	let transactions: any[] = [];
	let loading = true;

	onMount(async () => {
		try {
			const params = new URLSearchParams({ limit: '20' });
			const result = await api.getTransactions(token, params);
			transactions = result.data ?? [];
		} catch (e) {
			console.error(e);
		} finally {
			loading = false;
		}
	});
</script>

<slot />

<style>
	:global(body) { margin: 0; font-family: system-ui; }
</style>
