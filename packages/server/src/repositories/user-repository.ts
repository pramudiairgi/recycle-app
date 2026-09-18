import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { users } from '@recycle-app/db';
import type { User, NewUser } from '@recycle-app/db';
import type { DB } from './base-repository';

export class UserRepository extends BaseRepository<User> {
	constructor(db: DB) {
		super(db, 'users');
	}

	async findByEmail(email: string, tenantId: number): Promise<User | null> {
		const result = await this.db.get<User>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE email = ${email} AND tenant_id = ${tenantId}`);
		return result ?? null;
	}

	/** Global email lookup for login (tenant resolved from the user row). */
	async findByEmailAny(email: string): Promise<User | null> {
		const result = await this.db.get<User>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE email = ${email} LIMIT 1`);
		return result ?? null;
	}

	async findByRole(role: string, tenantId: number): Promise<User[]> {
		const results = await this.db.all<User>(sql`SELECT * FROM ${sql.raw(this.table)} WHERE role = ${role} AND tenant_id = ${tenantId}`);
		return results;
	}
}
