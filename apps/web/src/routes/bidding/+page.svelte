<script lang="ts">
	import { api } from '$lib/api';
	import { onMount } from 'svelte';

	let token = localStorage.getItem('recycle_token') ?? '';
	let categoryId = 1;
	let tonStock = 1000;
	let rankings: any[] = [];
	let loading = false;
	let error = '';

	async function fetchRank() {
		loading = true;
		error = '';
		try {
			const result = await api.getBiddingRank(token, categoryId, tonStock);
			rankings = result.data ?? [];
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	function formatIdr(n: number): string {
		return n.toLocaleString('id-ID');
	}
</script>

<h1>Bidding & Factory Ranking</h1>

<div class="form-card">
	<h3>Cari Pabrik Terbaik</h3>
	<div class="form-row">
		<div class="form-group">
			<label>Category ID</label>
			<input type="number" bind:value={categoryId} />
		</div>
		<div class="form-group">
			<label>Ton Stock</label>
			<input type="number" bind:value={tonStock} />
		</div>
	</div>
	<button on:click={fetchRank}>Ranking</button>
</div>

{#if loading}<p>Loading...</p>
{:else if error}<p class="error">Error: {error}</p>
{:else}
	<h2>Ranking</h2>
	<table>
		<thead><tr><th>Rank</th><th>Factory</th><th>Net Margin</th></tr></thead>
		<tbody>
			{#each rankings as r, i}
				<tr>
					<td>{i + 1}</td>
					<td>{r.factoryName ?? r.name ?? 'N/A'}</td>
					<td>Rp {formatIdr(r.netMarginIdr ?? 0)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.form-card { background: white; padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	.form-row { display: flex; gap: 1rem; }
	.form-group { flex: 1; margin-bottom: 1rem; }
	.form-group label { display: block; margin-bottom: 0.25rem; font-weight: 600; font-size: 0.875rem; }
	.form-group input { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; }
	button { background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer; }
	.error { color: #dc2626; }
	table { width: 100%; background: white; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	th, td { padding: 0.75rem 1rem; text-align: left; }
	th { background: #f1f5f9; font-weight: 600; font-size: 0.875rem; color: #64748b; }
</style>
