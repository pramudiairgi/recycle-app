<script lang="ts">
	import { onMount } from 'svelte';
	import { flushOutbox, scheduleSync, pendingCount } from '$lib/offline/sync';

	// PWA offline banner placeholder
	let isOnline = true;
	let pending = 0;

	async function flush() {
		const token = localStorage.getItem('recycle_token') ?? '';
		if (!token) return;
		await flushOutbox(token);
		pending = await pendingCount();
	}

	onMount(() => {
		isOnline = navigator.onLine;
		const onOnline = () => {
			isOnline = true;
			void flush();
		};
		const onOffline = () => {
			isOnline = false;
		};
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
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</svelte:head>

<nav>
	<!-- Navigation stub -->
	<slot />
</nav>

{#if !isOnline}
	<div class="offline-banner">
		<!-- PWA offline banner placeholder -->
		You are offline. Data will sync when reconnected.{#if pending > 0} {pending} transaction(s) queued.{/if}
	</div>
{/if}

<style>
	.offline-banner {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: #dc2626;
		color: white;
		text-align: center;
		padding: 0.5rem;
	}
</style>
