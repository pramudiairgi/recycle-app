import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { ledgers } from '@recycle-app/db';
import type { Ledger, NewLedger } from '@recycle-app/db';
import type { DB } from './base-repository';

export class LedgerRepository extends BaseRepository<Ledger> {
	constructor(db: DB) {
		super(db, 'ledgers');
	}

	async findByType(type: string, tenantId: number): Promise<Ledger[]> {
		const results = await this.db.all<Ledger>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE type = ${type} AND tenant_id = ${tenantId}`);
		return results;
	}

	async findByReference(referenceId: string, tenantId: number): Promise<Ledger | null> {
		const result = await this.db.get<Ledger>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE reference_id = ${referenceId} AND tenant_id = ${tenantId}`);
		return result ?? null;
	}

	async findRecent(tenantId: number, limit: number = 50): Promise<Ledger[]> {
		const results = await this.db.all<Ledger>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT ${limit}`);
		return results;
	}
}
