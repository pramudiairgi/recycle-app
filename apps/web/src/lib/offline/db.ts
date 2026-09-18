export interface OutboxEntry {
	clientMutationId: string;
	type: 'INBOUND' | 'OUTBOUND';
	customerId?: number;
	totalIdr: number;
	proofPhotoUrl?: string;
	offlineTimestamp: string;
	factoryId?: number;
	acceptedQuoteId?: number;
	items: Array<{ categoryId: number; weightKg: number; appliedPriceIdr: number; subtotalIdr: number }>;
	photoBlob?: Blob;
	createdAt: number;
	attempts: number;
}

const DB_NAME = 'recycle-outbox';
const STORE = 'pending';

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			req.result.createObjectStore(STORE, { keyPath: 'clientMutationId' });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	return openDb().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const t = db.transaction(STORE, mode);
				const req = fn(t.objectStore(STORE));
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
				t.oncomplete = () => db.close();
			}),
	);
}

export function enqueue(entry: OutboxEntry): Promise<void> {
	return tx('readwrite', (s) => s.put(entry)).then(() => undefined);
}

export function listPending(): Promise<OutboxEntry[]> {
	return tx('readonly', (s) => s.getAll());
}

export function removeEntry(clientMutationId: string): Promise<void> {
	return tx('readwrite', (s) => s.delete(clientMutationId)).then(() => undefined);
}

export function bumpAttempts(clientMutationId: string, attempts: number): Promise<void> {
	return listPending().then((all) => {
		const found = all.find((e) => e.clientMutationId === clientMutationId);
		if (!found) return;
		return tx('readwrite', (s) => s.put({ ...found, attempts })).then(() => undefined);
	});
}

export function newMutationId(): string {
	return crypto.randomUUID();
}
