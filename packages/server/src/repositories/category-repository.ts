import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { categories } from '@recycle-app/db';
import type { Category, NewCategory } from '@recycle-app/db';
import type { DB } from './base-repository';

export class CategoryRepository extends BaseRepository<Category> {
	constructor(db: DB) {
		super(db, 'categories');
	}

	async findActive(tenantId: number): Promise<Category[]> {
		const results = await this.db.all<Category>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE tenant_id = ${tenantId} AND is_active = true`);
		return results;
	}

	async findByPriceRange(minPrice: number, maxPrice: number, tenantId: number): Promise<Category[]> {
		const results = await this.db.all<Category>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE tenant_id = ${tenantId} AND price_per_kg BETWEEN ${minPrice} AND ${maxPrice}`);
		return results;
	}
}
