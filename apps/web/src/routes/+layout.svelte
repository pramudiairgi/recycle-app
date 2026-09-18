<script lang="ts">
	import { onMount } from 'svelte';
	import { flushOutbox, scheduleSync, pendingCount } from '$lib/offline/sync';
	import { api } from '$lib/api';

	let isOnline = true;
	let pending = 0;
	let token = localStorage.getItem('recycle_token') ?? '';
	let user = JSON.parse(localStorage.getItem('recycle_user') ?? 'null') as { id: number; tenantId: number; role: string } | null;
	let activePage = 'dashboard';

	const pages = [
		{ id: 'dashboard', label: 'Dashboard', icon: '📊' },
		{ id: 'transactions', label: 'Transaksi', icon: '📦' },
		{ id: 'bidding', label: 'Bidding', icon: '🏭' },
		{ id: 'stock', label: 'Stock Lots', icon: '📦' },
		{ id: 'finance', label: 'Keuangan', icon: '💰' },
		{ id: 'settings', label: 'Pengaturan', icon: '⚙️' },
	];

	async function flush() {
		if (!token) return;
		await flushOutbox(token);
		pending = await pendingCount();
	}

	function logout() {
		token = '';
		user = null;
		localStorage.removeItem('recycle_token');
		localStorage.removeItem('recycle_user');
		activePage = 'dashboard';
	}

	onMount(() => {
		isOnline = navigator.onLine;
		const onOnline = () => { isOnline = true; void flush(); };
		const onOffline = () => { isOnline = false; };
		const onMessage = (event: MessageEvent) => {
			if (event.data?.type === 'FLUSH_OUTBOX') void flush();
		};
		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);
		navigator.serviceWorker?.addEventListener('message', onMessage);
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
		}
		void scheduleSync();
		void pendingCount().then((n) => (pending = n));
		return () => {
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
			navigator.serviceWorker?.removeEventListener('message', onMessage);
		};
	});

	function navigate(page: string) {
		activePage = page;
	}
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta name="theme-color" content="#0f172a" />
</svelte:head>

<div class="app">
	<nav class="sidebar">
		<div class="sidebar-header">
			<h2>♻️ Recycle ERP</h2>
		</div>
		<ul class="nav-list">
			{#each pages as p}
				<li class:active={activePage === p.id} on:click={() => navigate(p.id)}>
					<span class="icon">{p.icon}</span>
					<span>{p.label}</span>
				</li>
			{/each}
		</ul>
		{#if user}
			<div class="sidebar-footer">
				<span>{user.role}</span>
				<button on:click={logout}>Logout</button>
			</div>
		{/if}
	</nav>

	<main class="content">
		{#if !isOnline}
			<div class="offline-banner">
				⚠️ Offline. Data akan sync saat terhubung.
				{#if pending > 0} {pending} transaksi antrian.{/if}
			</div>
		{/if}

		<slot />
	</main>
</div>

<style>
	.app { display: flex; min-height: 100vh; font-family: system-ui, sans-serif; }
	.sidebar { width: 220px; background: #0f172a; color: white; padding: 1rem; display: flex; flex-direction: column; }
	.sidebar-header h2 { margin: 0 0 1rem; font-size: 1.1rem; }
	.nav-list { list-style: none; padding: 0; margin: 0; flex: 1; }
	.nav-list li { padding: 0.75rem 1rem; cursor: pointer; border-radius: 0.5rem; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem; }
	.nav-list li:hover { background: #1e293b; }
	.nav-list li.active { background: #3b82f6; }
	.sidebar-footer { padding: 1rem; border-top: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
	.sidebar-footer button { background: #dc2626; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 0.3rem; cursor: pointer; }
	.content { flex: 1; padding: 1.5rem; background: #f8fafc; overflow-y: auto; }
	.offline-banner { background: #dc2626; color: white; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem; text-align: center; }
</style>
