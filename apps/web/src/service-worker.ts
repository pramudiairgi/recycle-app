const CACHE = 'recycle-v1';
const SHELL = ['/', '/manifest.json'];

self.addEventListener('install', (event: any) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache: any) => cache.addAll(SHELL))
			.then(() => (self as any).skipWaiting()),
	);
});

self.addEventListener('activate', (event: any) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys: string[]) => Promise.all(keys.filter((k: string) => k !== CACHE).map((k: string) => caches.delete(k))))
			.then(() => (self as any).clients.claim()),
	);
});

self.addEventListener('fetch', (event: any) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== location.origin) return;
	event.respondWith(
		fetch(event.request)
			.then((res: any) => {
				const copy = res.clone();
				caches.open(CACHE).then((cache: any) => cache.put(event.request, copy));
				return res;
			})
			.catch(() =>
				caches.match(event.request).then(
					(hit: any) =>
						hit ??
						(event.request.mode === 'navigate'
							? caches.match('/').then((r: any) => r)
							: Promise.reject(new Error('offline'))),
				),
			),
	);
});

self.addEventListener('sync', (event: any) => {
	if (event.tag === 'recycle-sync') {
		event.waitUntil(
			(self as any).clients.matchAll().then((clients: any[]) => {
				for (const c of clients) c.postMessage({ type: 'FLUSH_OUTBOX' });
			}),
		);
	}
});
