import { serve, env } from 'bun';
import { dispatch, addRoute, type RouteDeps } from './http/router';
import { RATE_LIMITS } from './http/rate-limit';
import { createPgAdapter, databaseUrl, type PgAdapter } from './db/pg-adapter';
import { buildContainer } from './di/wiring';
import { registerV1 } from './routes/v1';

export const port = Number(env.PORT ?? '3000');

function jwtSecret(): string {
	const s = env.JWT_SECRET;
	if (!s) throw new Error('JWT_SECRET environment variable is required');
	return s;
}

function apiKeys(): Set<string> {
	const raw = env.API_KEYS ?? '';
	return new Set(raw.split(',').map((k) => k.trim()).filter(Boolean));
}

export function buildDeps(): RouteDeps {
	return { auth: { apiKeys: apiKeys(), jwtSecret: jwtSecret() } };
}

export interface RunningServer {
	adapter: PgAdapter;
	stop(): void;
}

// Health check — public, PRD §5.
addRoute('GET', '/up', async () => Response.json({ status: 'ok' }), {
	scope: null,
	...RATE_LIMITS.read,
});

let v1Registered = false;

export function start(deps: RouteDeps = buildDeps(), serverPort = port): RunningServer {
	const adapter = createPgAdapter(databaseUrl());
	const container = buildContainer(adapter.db);
	if (!v1Registered) {
		registerV1(container, deps.auth.jwtSecret);
		v1Registered = true;
	}
	const server = serve({
		port: serverPort,
		fetch(req) {
			return dispatch(req, deps);
		},
	});
	return {
		adapter,
		stop: () => {
			server.stop();
			void adapter.close();
		},
	};
}
