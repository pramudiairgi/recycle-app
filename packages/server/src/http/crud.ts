import { NotFoundError } from '../errors/not-found-error';
import { ValidationError } from '../errors/validation-error';
import type { Scope } from '../auth/middleware';
import { addRoute, type Handler } from './router';
import { ok, okPaged, parsePagination, paginateRows } from './envelope';
import { RATE_LIMITS } from './rate-limit';

export interface CrudRepo<T> {
	findAll(tenantId: number): Promise<T[]>;
	findById(id: number, tenantId: number): Promise<T | null>;
	create(data: Partial<T>, tenantId: number): Promise<T>;
	update(id: number, data: Partial<T>, tenantId: number): Promise<T>;
	delete(id: number, tenantId: number): Promise<void>;
}

export interface CrudOptions {
	readScope: Scope;
	writeScope: Scope;
	writable: boolean; // false = GET-only (e.g. ledgers are immutable)
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
	try {
		const body = (await req.json()) as unknown;
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			throw new ValidationError('Request body must be a JSON object', { body: ['must be object'] });
		}
		return body as Record<string, unknown>;
	} catch (err) {
		if (err instanceof ValidationError) throw err;
		throw new ValidationError('Malformed JSON body', { body: ['invalid JSON'] });
	}
}

const getId = (row: unknown): number => (row as { id: number }).id;

export function registerCrud<T>(prefix: string, repo: CrudRepo<T>, opts: CrudOptions): void {
	const list: Handler = async (req, ctx, _params, url) => {
		const { limit, cursor } = parsePagination(url);
		const rows = await repo.findAll(ctx.tenantId);
		const { page, nextCursor } = paginateRows(rows, getId, limit, cursor);
		return okPaged(page, limit, nextCursor);
	};
	addRoute('GET', prefix, list, { scope: opts.readScope, ...RATE_LIMITS.read });

	const show: Handler = async (_req, ctx, params) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) throw new NotFoundError('Resource not found');
		const row = await repo.findById(id, ctx.tenantId);
		if (!row) throw new NotFoundError('Resource not found');
		return ok(row);
	};
	addRoute('GET', `${prefix}/:id`, show, { scope: opts.readScope, ...RATE_LIMITS.read });

	if (!opts.writable) return;

	const create: Handler = async (req, ctx) => {
		const body = await readJson(req);
		const row = await repo.create(body as Partial<T>, ctx.tenantId);
		return ok(row, 201);
	};
	addRoute('POST', prefix, create, { scope: opts.writeScope, ...RATE_LIMITS.read });

	const update: Handler = async (req, ctx, params) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) throw new NotFoundError('Resource not found');
		const existing = await repo.findById(id, ctx.tenantId);
		if (!existing) throw new NotFoundError('Resource not found');
		const body = await readJson(req);
		const row = await repo.update(id, body as Partial<T>, ctx.tenantId);
		return ok(row);
	};
	addRoute('PUT', `${prefix}/:id`, update, { scope: opts.writeScope, ...RATE_LIMITS.read });

	const remove: Handler = async (_req, ctx, params) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) throw new NotFoundError('Resource not found');
		const existing = await repo.findById(id, ctx.tenantId);
		if (!existing) throw new NotFoundError('Resource not found');
		await repo.delete(id, ctx.tenantId);
		return new Response(null, { status: 204 });
	};
	addRoute('DELETE', `${prefix}/:id`, remove, { scope: opts.writeScope, ...RATE_LIMITS.read });
}
