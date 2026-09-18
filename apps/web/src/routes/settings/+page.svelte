<script lang="ts">
	import { api } from '$lib/api';

	let token = localStorage.getItem('recycle_token') ?? '';
	let user = JSON.parse(localStorage.getItem('recycle_user') ?? 'null') as { id: number; tenantId: number; role: string } | null;

	function logout() {
		localStorage.removeItem('recycle_token');
		localStorage.removeItem('recycle_user');
		window.location.href = '/';
	}
</script>

<h1>Pengaturan</h1>

<div class="form-card">
	<h3>Profil</h3>
	<p><strong>ID:</strong> {user?.id ?? '-'}</p>
	<p><strong>Tenant:</strong> {user?.tenantId ?? '-'}</p>
	<p><strong>Role:</strong> {user?.role ?? '-'}</p>
</div>

<div class="form-card">
	<h3>Aplikasi</h3>
	<p>Recycle App — Circular Economy ERP</p>
	<p>Version: 1.0.0</p>
	<p>Stack: Bun + SvelteKit 5 + Drizzle ORM</p>
</div>

<div class="form-card">
	<h3>Offline</h3>
	<p>PWA dengan IndexedDB + Background Sync aktif.</p>
</div>

<button on:click={logout}>Logout</button>

<style>
	.form-card { background: white; padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	button { background: #dc2626; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer; }
</style>
