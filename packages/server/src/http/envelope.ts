import { AppError } from '../errors/app-error';

export interface PageInfo {
	limit: number;
	cursor: string | null;
	nextCursor: string | null;
}

export function ok<T>(data: T, status = 200): Response {
	return Response.json({ data }, { status });
}

export function okPaged<T>(rows: T[], limit: number, nextCursor: string | null): Response {
	const page: PageInfo = { limit, cursor: null, nextCursor };
	return Response.json({ data: rows, page }, { status: 200 });
}

export function fail(err: unknown): Response {
	if (err instanceof AppError) {
		return Response.json(
			{ error: { code: err.code, message: err.message } },
			{ status: err.statusCode },
		);
	}
	return Response.json(
		{ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
		{ status: 500 },
	);
}

export function parsePagination(url: URL): { limit: number; cursor: string | null } {
	const raw = Number(url.searchParams.get('limit') ?? '20');
	const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 100) : 20;
	const cursor = url.searchParams.get('cursor');
	return { limit, cursor };
}

/** Cursor is the last seen numeric id encoded as base64. Returns rows slice + next cursor. */
export function paginateRows<T>(rows: T[], getId: (row: T) => number, limit: number, cursor: string | null): { page: T[]; nextCursor: string | null } {
	let start = 0;
	if (cursor) {
		try {
			const decoded = Number(Buffer.from(cursor, 'base64').toString('utf8'));
			const idx = rows.findIndex((r) => getId(r) === decoded);
			start = idx >= 0 ? idx + 1 : 0;
		} catch {
			start = 0;
		}
	}
	const page = rows.slice(start, start + limit);
	const nextCursor =
		start + limit < rows.length ? Buffer.from(String(getId(page[page.length - 1]))).toString('base64') : null;
	return { page, nextCursor };
}
