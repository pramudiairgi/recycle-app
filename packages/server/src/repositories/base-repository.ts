import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export type DB = {
	all: <T>(query: SQL) => Promise<T[]>;
	get: <T>(query: SQL) => Promise<T | null>;
	run: (query: SQL) => Promise<void>;
	execute: (query: SQL) => Promise<void>;
	/** Optional transactional context. Falls back to direct execution when unsupported. */
	transaction?: <T>(fn: (tx: DB) => Promise<T>) => Promise<T>;
};

function toSnake(key: string): string {
	return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export abstract class BaseRepository<T> {
	constructor(
		protected db: DB,
		protected table: string,
	) {}

	async findById(id: number, tenantId: number): Promise<T | null> {
		const query = sql`SELECT * FROM ${sql.raw(this.table)} WHERE id = ${id} AND tenant_id = ${tenantId}`;
		const result = await this.db.get<T>(query);
		return result ?? null;
	}

	async findAll(tenantId: number): Promise<T[]> {
		const query = sql`SELECT * FROM ${sql.raw(this.table)} WHERE tenant_id = ${tenantId}`;
		return this.db.all<T>(query);
	}

	async create(data: Partial<T>, tenantId: number): Promise<T> {
		const entries = Object.entries(data).filter(([k]) => k !== 'id') as [string, unknown][];
		const cols = entries.map(([k]) => sql.raw(`"${toSnake(k)}"`));
		const vals = entries.map(([, v]) => sql`${v}`);
		const query = sql`INSERT INTO ${sql.raw(this.table)} (${sql.join(cols, sql`, `)}, tenant_id) VALUES (${sql.join(vals, sql`, `)}, ${tenantId}) RETURNING *`;
		const result = await this.db.get<T>(query);
		if (!result) throw new Error(`Insert into ${this.table} returned no row`);
		return result;
	}

	async update(id: number, data: Partial<T>, tenantId: number): Promise<T> {
		const entries = Object.entries(data).filter(([k]) => k !== 'id') as [string, unknown][];
		if (entries.length === 0) {
			const existing = await this.findById(id, tenantId);
			if (!existing) throw new Error(`Row ${id} not found in ${this.table}`);
			return existing;
		}
		const sets = entries.map(([k, v]) => sql`${sql.raw(`"${toSnake(k)}"`)} = ${v}`);
		const query = sql`UPDATE ${sql.raw(this.table)} SET ${sql.join(sets, sql`, `)} WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`;
		const result = await this.db.get<T>(query);
		if (!result) throw new Error(`Row ${id} not found in ${this.table}`);
		return result;
	}

	async delete(id: number, tenantId: number): Promise<void> {
		const query = sql`DELETE FROM ${sql.raw(this.table)} WHERE id = ${id} AND tenant_id = ${tenantId}`;
		await this.db.run(query);
	}
}
