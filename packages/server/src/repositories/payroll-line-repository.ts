import { sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import type { PayrollLine } from '@recycle-app/db';

export class PayrollLineRepository extends BaseRepository<PayrollLine> {
	constructor(db: DB) {
		super(db, 'payroll_lines');
	}

	async findByRun(payrollRunId: number, tenantId: number): Promise<PayrollLine[]> {
		const query = sql`SELECT * FROM ${sql.raw(this.table)} WHERE payroll_run_id = ${payrollRunId} AND tenant_id = ${tenantId} ORDER BY id ASC`;
		return this.db.all<PayrollLine>(query);
	}
}

import type { DB } from './base-repository';
