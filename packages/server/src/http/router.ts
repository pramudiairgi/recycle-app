import type { AuthContext, Scope } from '../auth/middleware';
import { authenticate, requireScope } from '../auth/middleware';
import type { AuthOptions } from '../auth/middleware';
import { fail } from './envelope';
import { isAllowed } from './rate-limit';

export interface RouteDeps {
	auth: AuthOptions;
}

export type Handler = (
	req: Request,
	ctx: AuthContext,
	params: Record<string, string>,
	url: URL,
	deps: RouteDeps,
) => Promise<Response>;

interface Route {
	method: string;
	pattern: RegExp;
	keys: string[];
	handler: Handler;
	scope: Scope | null; // null = public (still rate-limited, no auth)
	rateLimit: { limit: number; windowMs: number };
	rateKey: (req: Request, ctx: AuthContext | null) => string;
}

const routes: Route[] = [];

function compile(path: string): { pattern: RegExp; keys: string[] } {
	const keys: string[] = [];
	const src = path
		.split('/')
		.map((seg) => {
			if (seg.startsWith(':')) {
				keys.push(seg.slice(1));
				return '([^/]+)';
			}
			return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		})
		.join('/');
	return { pattern: new RegExp(`^${src}$`), keys };
}

export function addRoute(
	method: string,
	path: string,
	handler: Handler,
	opts: { scope?: Scope | null; limit?: number; windowMs?: number } = {},
): void {
	const { pattern, keys } = compile(path);
	routes.push({
		method: method.toUpperCase(),
		pattern,
		keys,
		handler,
		scope: opts.scope === undefined ? 'transactions:read' : opts.scope,
		rateLimit: { limit: opts.limit ?? 100, windowMs: opts.windowMs ?? 60_000 },
		rateKey: (_req, ctx) => (ctx ? `t${ctx.tenantId}:u${ctx.userId ?? 'key'}` : 'anon'),
	});
}

export function clearRoutes(): void {
	routes.length = 0;
}

export async function dispatch(req: Request, deps: RouteDeps): Promise<Response> {
	try {
		const url = new URL(req.url);
		const method = req.method.toUpperCase();
		for (const r of routes) {
			if (r.method !== method) continue;
			const match = r.pattern.exec(url.pathname);
			if (!match) continue;
			const params: Record<string, string> = {};
			r.keys.forEach((k, i) => {
				params[k] = decodeURIComponent(match[i + 1]);
			});
			let ctx: AuthContext | null = null;
			if (r.scope !== null) {
				ctx = await authenticate(req, deps.auth);
				requireScope(ctx, r.scope);
			}
			const key = `${r.method}:${url.pathname}:${r.rateKey(req, ctx)}`;
			if (!isAllowed(key, r.rateLimit.limit, r.rateLimit.windowMs)) {
				return Response.json(
					{ error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
					{ status: 429 },
				);
			}
			return await r.handler(req, ctx as AuthContext, params, url, deps);
		}
		return Response.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, { status: 404 });
	} catch (err) {
		return fail(err);
	}
}
