import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { tenants } from '@recycle-app/db';
import type { Tenant, NewTenant } from '@recycle-app/db';

export class TenantRepository extends BaseRepository<Tenant> {
	constructor(db: DB) {
		super(db, 'tenants');
	}

	async findByName(name: string, tenantId: number): Promise<Tenant | null> {
		const result = await this.db.get<Tenant>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE name = ${name} AND tenant_id = ${tenantId}`);
		return result ?? null;
	}

	async findBySlug(slug: string, tenantId: number): Promise<Tenant | null> {
		const result = await this.db.get<Tenant>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE slug = ${slug} AND tenant_id = ${tenantId}`);
		return result ?? null;
	}
}

import type { DB } from './base-repository';
