import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import type { Attendance } from '@recycle-app/db';

export class AttendanceRepository extends BaseRepository<Attendance> {
	constructor(db: DB) {
		super(db, 'attendances');
	}

	async findByUserPeriod(userId: number, tenantId: number, from: string, to: string): Promise<Attendance[]> {
		const query = sql`SELECT * FROM ${sql.raw(this.table)} WHERE user_id = ${userId} AND tenant_id = ${tenantId} AND date >= ${from} AND date <= ${to} ORDER BY date ASC`;
		return this.db.all<Attendance>(query);
	}

	async countPresent(userId: number, tenantId: number, from: string, to: string): Promise<number> {
		const query = sql`SELECT COUNT(*)::int AS count FROM ${sql.raw(this.table)} WHERE user_id = ${userId} AND tenant_id = ${tenantId} AND date >= ${from} AND date <= ${to} AND is_present = true`;
		const row = await this.db.get<{ count: number }>(query);
		return row?.count ?? 0;
	}
}

import type { DB } from './base-repository';
