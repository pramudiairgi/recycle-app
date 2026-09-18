import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { factories } from '@recycle-app/db';
import type { Factory, NewFactory } from '@recycle-app/db';
import type { DB } from './base-repository';

export class FactoryRepository extends BaseRepository<Factory> {
	constructor(db: DB) {
		super(db, 'factories');
	}

	async findActive(tenantId: number): Promise<Factory[]> {
		const results = await this.db.all<Factory>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE tenant_id = ${tenantId} AND is_active = true`);
		return results;
	}

	async findByName(name: string, tenantId: number): Promise<Factory | null> {
		const result = await this.db.get<Factory>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE name = ${name} AND tenant_id = ${tenantId}`);
		return result ?? null;
	}
}
