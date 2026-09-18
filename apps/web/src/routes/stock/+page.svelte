<script lang="ts">
	import { api } from '$lib/api';
	import { onMount } from 'svelte';

	let token = localStorage.getItem('recycle_token') ?? '';
	let stockLots: any[] = [];
	let available: any = {};
	let categoryId = 1;
	let loading = false;
	let error = '';

	async function loadStock() {
		loading = true;
		try {
			const lots = await api.getStockLots(token);
			stockLots = lots.data ?? [];
			const avail = await api.getStockAvailable(token, categoryId);
			available = avail.data ?? {};
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	function formatIdr(n: number): string {
		return n.toLocaleString('id-ID');
	}

	onMount(loadStock);
</script>

<h1>Stock Lots & FIFO</h1>

<div class="form-card">
	<div class="form-group">
		<label>Category ID</label>
		<input type="number" bind:value={categoryId} on:change={loadStock} />
	</div>
	<button on:click={loadStock}>Refresh</button>
</div>

{#if loading}<p>Loading...</p>
{:else if error}<p class="error">Error: {error}</p>
{:else}
	<h2>Available Stock</h2>
	<p>Category {categoryId}: {available.availableKg ?? 0} kg</p>

	<h2>Stock Lots</h2>
	<table>
		<thead><tr><th>ID</th><th>Category</th><th>Weight (kg)</th><th>HPP/kg</th><th>Remaining</th></tr></thead>
		<tbody>
			{#each stockLots as lot}
				<tr>
					<td>{lot.id}</td>
					<td>{lot.categoryId}</td>
					<td>{lot.weightKg}</td>
					<td>Rp {formatIdr(lot.hppPerKg)}</td>
					<td>{lot.weightKg - (lot.consumedWeightKg ?? 0)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.form-card { background: white; padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	.form-group { margin-bottom: 1rem; }
	.form-group label { display: block; margin-bottom: 0.25rem; font-weight: 600; font-size: 0.875rem; }
	.form-group input { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; }
	button { background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer; }
	.error { color: #dc2626; }
	table { width: 100%; background: white; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	th, td { padding: 0.75rem 1rem; text-align: left; }
	th { background: #f1f5f9; font-weight: 600; font-size: 0.875rem; color: #64748b; }
</style>
