<script lang="ts">
	import { api } from '$lib/api';
	import { onMount } from 'svelte';

	let token = localStorage.getItem('recycle_token') ?? '';
	let ledgers: any[] = [];
	let payrollRuns: any[] = [];
	let loading = false;
	let error = '';

	async function loadFinance() {
		loading = true;
		try {
			const l = await api.getLedgers(token);
			ledgers = l.data ?? [];
			const p = await api.getPayrollRuns(token);
			payrollRuns = p.data ?? [];
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	function formatIdr(n: number): string {
		return n.toLocaleString('id-ID');
	}

	onMount(loadFinance);
</script>

<h1>Keuangan</h1>

{#if loading}<p>Loading...</p>
{:else if error}<p class="error">Error: {error}</p>
{:else}
	<h2>Ledger</h2>
	<table>
		<thead><tr><th>ID</th><th>Type</th><th>Amount</th><th>Balance After</th><th>Ref</th></tr></thead>
		<tbody>
			{#each ledgers as l}
				<tr>
					<td>{l.id}</td>
					<td>{l.type}</td>
					<td>Rp {formatIdr(l.amountIdr)}</td>
					<td>Rp {formatIdr(l.balanceAfterIdr)}</td>
					<td>{l.referenceId}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<h2>Payroll Runs</h2>
	<table>
		<thead><tr><th>Period</th><th>Base Salary</th><th>Total</th><th>Status</th></tr></thead>
		<tbody>
			{#each payrollRuns as p}
				<tr>
					<td>{p.period}</td>
					<td>Rp {formatIdr(p.baseSalaryIdr ?? 0)}</td>
					<td>Rp {formatIdr(p.totalIdr ?? 0)}</td>
					<td>{p.status}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.error { color: #dc2626; }
	table { width: 100%; background: white; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
	th, td { padding: 0.75rem 1rem; text-align: left; }
	th { background: #f1f5f9; font-weight: 600; font-size: 0.875rem; color: #64748b; }
	h2 { margin-top: 2rem; }
</style>
