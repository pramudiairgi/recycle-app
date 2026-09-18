import { describe, it, expect } from 'bun:test';
import { paginateRows, parsePagination } from './envelope';

const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
const getId = (r: { id: number }) => r.id;
const cursorFor = (id: number) => Buffer.from(String(id)).toString('base64');

describe('paginateRows', () => {
	it('returns first page with next cursor when more rows remain', () => {
		const { page, nextCursor } = paginateRows(rows, getId, 2, null);
		expect(page.map(getId)).toEqual([1, 2]);
		expect(nextCursor).toBe(cursorFor(2));
	});

	it('continues from cursor and ends with null cursor', () => {
		const mid = paginateRows(rows, getId, 2, cursorFor(2));
		expect(mid.page.map(getId)).toEqual([3, 4]);
		expect(mid.nextCursor).toBe(cursorFor(4));
		const last = paginateRows(rows, getId, 2, cursorFor(4));
		expect(last.page.map(getId)).toEqual([5]);
		expect(last.nextCursor).toBeNull();
	});

	it('treats unknown cursor as first page', () => {
		const { page } = paginateRows(rows, getId, 2, cursorFor(999));
		expect(page.map(getId)).toEqual([1, 2]);
	});
});

describe('parsePagination', () => {
	it('clamps limit to 1..100 with default 20', () => {
		expect(parsePagination(new URL('http://x/')).limit).toBe(20);
		expect(parsePagination(new URL('http://x/?limit=500')).limit).toBe(100);
		expect(parsePagination(new URL('http://x/?limit=0')).limit).toBe(1);
		expect(parsePagination(new URL('http://x/?limit=abc')).limit).toBe(20);
	});

	it('passes cursor through', () => {
		expect(parsePagination(new URL('http://x/?cursor=zzz')).cursor).toBe('zzz');
		expect(parsePagination(new URL('http://x/')).cursor).toBeNull();
	});
});
