import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import type { PayrollRun } from '@recycle-app/db';

export class PayrollRunRepository extends BaseRepository<PayrollRun> {
	constructor(db: DB) {
		super(db, 'payroll_runs');
	}

	async findByPeriod(period: string, tenantId: number): Promise<PayrollRun | null> {
		const query = sql`SELECT * FROM ${sql.raw(this.table)} WHERE period = ${period} AND tenant_id = ${tenantId}`;
		const result = await this.db.get<PayrollRun>(query);
		return result ?? null;
	}
}

import type { DB } from './base-repository';
