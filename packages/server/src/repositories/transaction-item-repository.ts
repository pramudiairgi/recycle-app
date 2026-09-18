import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { transactionItems } from '@recycle-app/db';
import type { TransactionItem, NewTransactionItem } from '@recycle-app/db';
import type { DB } from './base-repository';

export class TransactionItemRepository extends BaseRepository<TransactionItem> {
	constructor(db: DB) {
		super(db, 'transaction_items');
	}

	async findByTransaction(transactionId: number, tenantId: number): Promise<TransactionItem[]> {
		const results = await this.db.all<TransactionItem>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE transaction_id = ${transactionId} AND tenant_id = ${tenantId}`);
		return results;
	}

	async findByCategory(categoryId: number, tenantId: number): Promise<TransactionItem[]> {
		const results = await this.db.all<TransactionItem>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE category_id = ${categoryId} AND tenant_id = ${tenantId}`);
		return results;
	}
}
