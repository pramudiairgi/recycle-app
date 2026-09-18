const CACHE = 'recycle-v1';
const SHELL = ['/', '/manifest.json'];

interface SyncEvent extends ExtendableEvent {
	readonly tag: string;
}

self.addEventListener('install', (event) => {
	const e = event as ExtendableEvent;
	e.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(SHELL))
			.then(() => (self as unknown as ServiceWorkerGlobalScope).skipWaiting()),
	);
});

self.addEventListener('activate', (event) => {
	const e = event as ExtendableEvent;
	e.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => (self as unknown as ServiceWorkerGlobalScope).clients.claim()),
	);
});

self.addEventListener('fetch', (event) => {
	const e = event as FetchEvent;
	const url = new URL(e.request.url);
	if (e.request.method !== 'GET' || url.origin !== location.origin) return;
	e.respondWith(
		fetch(e.request)
			.then((res) => {
				const copy = res.clone();
				caches.open(CACHE).then((cache) => cache.put(e.request, copy));
				return res;
			})
			.catch(() =>
				caches.match(e.request).then(
					(hit) =>
						hit ??
						(e.request.mode === 'navigate'
							? caches.match('/').then((r) => r as Response)
							: Promise.reject(new Error('offline'))),
				),
			),
	);
});

self.addEventListener('sync', (event) => {
	const e = event as SyncEvent;
	if (e.tag === 'recycle-sync') {
		e.waitUntil(
			(self as unknown as ServiceWorkerGlobalScope).clients.matchAll().then((clients) => {
				for (const c of clients) c.postMessage({ type: 'FLUSH_OUTBOX' });
			}),
		);
	}
});
