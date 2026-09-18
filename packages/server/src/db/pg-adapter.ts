import { Pool, type PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { SQL } from 'drizzle-orm';
import type { DB } from '../repositories/base-repository';

function wrap(exec: <T>(query: SQL) => Promise<{ rows: T[] }>): DB {
	// Postgres returns snake_case columns; services consume camelCase types.
	const toCamel = <T>(row: T): T => {
		if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
			out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
		}
		return out as T;
	};
	const db: DB = {
		all: async <T>(query: SQL): Promise<T[]> => (await exec<T>(query)).rows.map(toCamel),
		get: async <T>(query: SQL): Promise<T | null> => {
			const { rows } = await exec<T>(query);
			return rows[0] ? toCamel(rows[0]) : null;
		},
		run: async (query: SQL): Promise<void> => {
			await exec(query);
		},
		execute: async (query: SQL): Promise<void> => {
			await exec(query);
		},
	};
	db.transaction = async <T>(fn: (tx: DB) => Promise<T>): Promise<T> => fn(db);
	return db;
}

export interface PgAdapter {
	db: DB;
	pool: Pool;
	close(): Promise<void>;
}

export function createPgAdapter(connectionString: string): PgAdapter {
	const pool = new Pool({ connectionString });
	const orm = drizzle(pool);
	const exec = <T>(query: SQL) => orm.execute(query) as unknown as Promise<{ rows: T[] }>;
	const base = wrap(exec);
	const db: DB = {
		...base,
		transaction: async <T>(fn: (tx: DB) => Promise<T>): Promise<T> => {
			const client: PoolClient = await pool.connect();
			try {
				await client.query('BEGIN');
				const ormTx = drizzle(client);
				const txExec = <R>(query: SQL) => ormTx.execute(query) as unknown as Promise<{ rows: R[] }>;
				const result = await fn(wrap(txExec));
				await client.query('COMMIT');
				return result;
			} catch (err) {
				await client.query('ROLLBACK');
				throw err;
			} finally {
				client.release();
			}
		},
	};
	return { db, pool, close: () => pool.end() };
}

export function databaseUrl(): string {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL environment variable is required');
	return url;
}
