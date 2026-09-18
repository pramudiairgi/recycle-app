import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { productionLogs } from '@recycle-app/db';
import type { ProductionLog, NewProductionLog } from '@recycle-app/db';
import type { DB } from './base-repository';

export class ProductionLogRepository extends BaseRepository<ProductionLog> {
	constructor(db: DB) {
		super(db, 'production_logs');
	}

	async findByTransaction(transactionId: number, tenantId: number): Promise<ProductionLog[]> {
		const results = await this.db.all<ProductionLog>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE transaction_id = ${transactionId} AND tenant_id = ${tenantId}`);
		return results;
	}

	async findByCategory(categoryId: number, tenantId: number): Promise<ProductionLog[]> {
		const results = await this.db.all<ProductionLog>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE category_id = ${categoryId} AND tenant_id = ${tenantId}`);
		return results;
	}

	async findShrinkage(tenantId: number): Promise<ProductionLog[]> {
		const results = await this.db.all<ProductionLog>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE tenant_id = ${tenantId} AND shrinkage_kg > 0 ORDER BY created_at DESC`);
		return results;
	}
}
