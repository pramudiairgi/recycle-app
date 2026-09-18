import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { transactions } from '@recycle-app/db';
import type { Transaction, NewTransaction } from '@recycle-app/db';
import type { DB } from './base-repository';

export class TransactionRepository extends BaseRepository<Transaction> {
	constructor(db: DB) {
		super(db, 'transactions');
	}

	async findByCustomer(customerId: number, tenantId: number): Promise<Transaction[]> {
		const results = await this.db.all<Transaction>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE customer_id = ${customerId} AND tenant_id = ${tenantId}`);
		return results;
	}

	async findByStatus(status: string, tenantId: number): Promise<Transaction[]> {
		const results = await this.db.all<Transaction>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE status = ${status} AND tenant_id = ${tenantId}`);
		return results;
	}

	async findOfflineUnsynced(tenantId: number): Promise<Transaction[]> {
		const results = await this.db.all<Transaction>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE tenant_id = ${tenantId} AND status = 'DRAFT'`);
		return results;
	}

	async findByClientMutationId(clientMutationId: string, tenantId: number): Promise<Transaction | null> {
		const result = await this.db.get<Transaction>(
			sql`SELECT * FROM ${sql.raw(this.table)} WHERE client_mutation_id = ${clientMutationId} AND tenant_id = ${tenantId}`,
		);
		return result ?? null;
	}
}
