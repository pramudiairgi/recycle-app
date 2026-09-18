import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { factoryPriceQuotes } from '@recycle-app/db';
import type { FactoryPriceQuote, NewFactoryPriceQuote } from '@recycle-app/db';
import type { DB } from './base-repository';

export class FactoryPriceQuoteRepository extends BaseRepository<FactoryPriceQuote> {
	constructor(db: DB) {
		super(db, 'factory_price_quotes');
	}

	async findByFactory(factoryId: number, tenantId: number): Promise<FactoryPriceQuote[]> {
		const results = await this.db.all<FactoryPriceQuote>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE factory_id = ${factoryId} AND tenant_id = ${tenantId}`);
		return results;
	}

	async findByCategory(categoryId: number, tenantId: number): Promise<FactoryPriceQuote[]> {
		const results = await this.db.all<FactoryPriceQuote>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE category_id = ${categoryId} AND tenant_id = ${tenantId}`);
		return results;
	}

	async findAccepted(tenantId: number): Promise<FactoryPriceQuote[]> {
		const results = await this.db.all<FactoryPriceQuote>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE tenant_id = ${tenantId} AND is_accepted = true`);
		return results;
	}
}
