import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import type { StockLot } from '@recycle-app/db';

export class StockLotRepository extends BaseRepository<StockLot> {
	constructor(db: DB) {
		super(db, 'stock_lots');
	}

	/** Available lots (remaining > 0) oldest first — FIFO order. */
	async findAvailable(categoryId: number, tenantId: number): Promise<StockLot[]> {
		const query = sql`SELECT * FROM ${sql.raw(this.table)} WHERE category_id = ${categoryId} AND tenant_id = ${tenantId} AND (weight_kg::numeric - consumed_weight_kg::numeric) > 0 ORDER BY id ASC`;
		return this.db.all<StockLot>(query);
	}

	async findByCategory(categoryId: number, tenantId: number): Promise<StockLot[]> {
		const query = sql`SELECT * FROM ${sql.raw(this.table)} WHERE category_id = ${categoryId} AND tenant_id = ${tenantId} ORDER BY id ASC`;
		return this.db.all<StockLot>(query);
	}
}

import type { DB } from './base-repository';
