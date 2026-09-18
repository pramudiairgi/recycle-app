import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { customers } from '@recycle-app/db';
import type { Customer, NewCustomer } from '@recycle-app/db';
import type { DB } from './base-repository';

export class CustomerRepository extends BaseRepository<Customer> {
	constructor(db: DB) {
		super(db, 'customers');
	}

	async findByName(name: string, tenantId: number): Promise<Customer | null> {
		const result = await this.db.get<Customer>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE name = ${name} AND tenant_id = ${tenantId}`);
		return result ?? null;
	}

	async findByPhone(phone: string, tenantId: number): Promise<Customer | null> {
		const result = await this.db.get<Customer>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE phone = ${phone} AND tenant_id = ${tenantId}`);
		return result ?? null;
	}
}
