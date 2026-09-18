<script lang="ts">
	import { api } from '$lib/api';
	import { onMount } from 'svelte';

	let token = localStorage.getItem('recycle_token') ?? '';
	let transactions: any[] = [];
	let loading = true;
	let error = '';

	onMount(async () => {
		try {
			const params = new URLSearchParams({ limit: '20' });
			const result = await api.getTransactions(token, params);
			transactions = result.data ?? [];
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	});

	function formatIdr(n: number): string {
		return n.toLocaleString('id-ID');
	}

	function statusColor(s: string): string {
		const colors: Record<string, string> = { DRAFT: '#6b7280', SYNCED: '#3b82f6', VERIFIED: '#f59e0b', COMPLETED: '#10b981', CANCELLED: '#ef4444', PENDING: '#8b5cf6', FAILED: '#dc2626' };
		return colors[s] ?? '#6b7280';
	}
</script>

<h1>Dashboard</h1>

{#if loading}
	<p>Loading...</p>
{:else if error}
	<p class="error">Error: {error}</p>
{:else}
	<div class="stats">
		<div class="stat-card">
			<h3>Total Transaksi</h3>
			<p class="big">{transactions.length}</p>
		</div>
		<div class="stat-card">
			<h3>Completed</h3>
			<p class="big">{transactions.filter((t) => t.status === 'COMPLETED').length}</p>
		</div>
		<div class="stat-card">
			<h3>Pending Verify</h3>
			<p class="big">{transactions.filter((t) => t.status === 'SYNCED').length}</p>
		</div>
	</div>

	<h2>Transaksi Terakhir</h2>
	<table>
		<thead>
			<tr>
				<th>ID</th>
				<th>Tipe</th>
				<th>Total</th>
				<th>Status</th>
				<th>Tanggal</th>
			</tr>
		</thead>
		<tbody>
			{#each transactions.slice(0, 10) as txn}
				<tr>
					<td>{txn.id}</td>
					<td>{txn.type}</td>
					<td>Rp {formatIdr(txn.totalIdr)}</td>
					<td><span class="badge" style="background:{statusColor(txn.status)}">{txn.status}</span></td>
					<td>{txn.createdAt ? new Date(txn.createdAt).toLocaleDateString('id-ID') : '-'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
	.stat-card { background: white; padding: 1.5rem; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	.stat-card h3 { margin: 0 0 0.5rem; color: #64748b; font-size: 0.875rem; }
	.stat-card .big { margin: 0; font-size: 2rem; font-weight: 700; color: #0f172a; }
	table { width: 100%; background: white; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	th, td { padding: 0.75rem 1rem; text-align: left; }
	th { background: #f1f5f9; font-weight: 600; font-size: 0.875rem; color: #64748b; }
	.badge { padding: 0.2rem 0.5rem; border-radius: 9999px; color: white; font-size: 0.75rem; font-weight: 600; }
	.error { color: #dc2626; }
</style>
