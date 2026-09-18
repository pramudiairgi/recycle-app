import { listPending, removeEntry, bumpAttempts, type OutboxEntry } from './db';

const SYNC_TAG = 'recycle-sync';

export interface FlushResult {
	sent: number;
	duplicates: number;
	failed: number;
}

async function sendOne(entry: OutboxEntry, token: string): Promise<'sent' | 'duplicate' | 'failed'> {
	try {
		const { photoBlob: _photo, ...payload } = entry;
		const res = await fetch('/api/v1/transactions/sync', {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body: JSON.stringify(payload),
		});
		if (!res.ok) return 'failed';
		const data = (await res.json()) as { data?: { duplicate?: boolean } };
		const outcome = data?.data?.duplicate ? 'duplicate' : 'sent';
		await removeEntry(entry.clientMutationId);
		return outcome;
	} catch {
		await bumpAttempts(entry.clientMutationId, entry.attempts + 1);
		return 'failed';
	}
}

/** Flush the whole outbox. Throws nothing — failures stay queued for retry. */
export async function flushOutbox(token: string): Promise<FlushResult> {
	const pending = await listPending();
	const result: FlushResult = { sent: 0, duplicates: 0, failed: 0 };
	for (const entry of pending) {
		const outcome = await sendOne(entry, token);
		result[outcome === 'sent' ? 'sent' : outcome === 'duplicate' ? 'duplicates' : 'failed'] += 1;
	}
	return result;
}

export function pendingCount(): Promise<number> {
	return listPending().then((all) => all.length);
}

/** Register a Background Sync task; falls back to online-event flushing. */
export async function scheduleSync(): Promise<void> {
	try {
		const reg = await navigator.serviceWorker.ready;
		const syncManager = (reg as unknown as { sync?: { register(tag: string): Promise<void> } }).sync;
		if (syncManager) {
			await syncManager.register(SYNC_TAG);
			return;
		}
	} catch {
		// Background Sync unsupported — online listener covers retries.
	}
}

export { SYNC_TAG };
