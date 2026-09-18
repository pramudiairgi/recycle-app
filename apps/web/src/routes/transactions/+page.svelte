<script lang="ts">
	import { api } from '$lib/api';
	import { onMount } from 'svelte';
	import { newMutationId, enqueue } from '$lib/offline/db';

	let token = localStorage.getItem('recycle_token') ?? '';
	let transactions: any[] = [];
	let loading = true;
	let showForm = false;
	let formType = 'INBOUND';
	let customerId = '';
	let totalIdr = '';
	let error = '';

	const types = ['INBOUND', 'OUTBOUND'];

	onMount(async () => {
		await loadTransactions();
	});

	async function loadTransactions() {
		try {
			const params = new URLSearchParams({ limit: '50' });
			const result = await api.getTransactions(token, params);
			transactions = result.data ?? [];
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function createOffline() {
		const entry = {
			clientMutationId: newMutationId(),
			type: formType,
			customerId: customerId ? Number(customerId) : undefined,
			totalIdr: Number(totalIdr),
			offlineTimestamp: new Date().toISOString(),
			items: [{ categoryId: 1, weightKg: 0, appliedPriceIdr: 0, subtotalIdr: 0 }],
			createdAt: Date.now(),
			attempts: 0,
		};
		await enqueue(entry);
		showForm = false;
		await loadTransactions();
	}

	function formatIdr(n: number): string {
		return n.toLocaleString('id-ID');
	}

	function statusColor(s: string): string {
		const colors: Record<string, string> = { DRAFT: '#6b7280', SYNCED: '#3b82f6', VERIFIED: '#f59e0b', COMPLETED: '#10b981', CANCELLED: '#ef4444' };
		return colors[s] ?? '#6b7280';
	}
</script>

<h1>Transaksi</h1>

<div class="toolbar">
	<h2>Daftar Transaksi</h2>
	<button on:click={() => showForm = !showForm}>
		{showForm ? 'Batal' : '+ Tambah Transaksi'}
	</button>
</div>

{#if showForm}
	<div class="form-card">
		<h3>Buat Transaksi Offline</h3>
		<div class="form-group">
			<label>Tipe</label>
			select bind:value={formType}>
				{#each types as t}
					<option value={t}>{t}</option>
				{/each}
			</select>
		</div>
		<div class="form-group">
			<label>Customer ID</label>
			<input type="number" bind:value={customerId} placeholder="ID customer" />
		</div>
		<div class="form-group">
			<label>Total IDR</label>
			<input type="number" bind:value={totalIdr} placeholder="Dalam rupiah" />
		</div>
		<button on:click={createOffline}>Simpan Offline</button>
		<p class="hint">Data tersimpan di IndexedDB dan akan sync saat online.</p>
	</div>
{/if}

{#if loading}
	<p>Loading...</p>
{:else}
	<table>
		<thead>
			<tr><th>ID</th><th>Tipe</th><th>Total</th><th>Status</th><th>Aksi</th></tr>
		</thead>
		<tbody>
			{#each transactions as txn}
				<tr>
					<td>{txn.id}</td>
					<td>{txn.type}</td>
					<td>Rp {formatIdr(txn.totalIdr)}</td>
					<td><span class="badge" style="background:{statusColor(txn.status)}">{txn.status}</span></td>
					<td>
						{#if txn.status === 'DRAFT'}
							<button small on:click={() => {}}>Verify</button>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
	.form-card { background: white; padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	.form-group { margin-bottom: 1rem; }
	.form-group label { display: block; margin-bottom: 0.25rem; font-weight: 600; font-size: 0.875rem; }
	.form-group input, .form-group select { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; }
	button { background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer; }
	button small { background: #f59e0b; padding: 0.2rem 0.5rem; font-size: 0.75rem; }
	.hint { color: #6b7280; font-size: 0.75rem; }
	.badge { padding: 0.2rem 0.5rem; border-radius: 9999px; color: white; font-size: 0.75rem; font-weight: 600; }
	table { width: 100%; background: white; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	th, td { padding: 0.75rem 1rem; text-align: left; }
	th { background: #f1f5f9; font-weight: 600; font-size: 0.875rem; color: #64748b; }
</style>
