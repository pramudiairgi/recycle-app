import { ValidationError } from '../errors/validation-error';
import { NotFoundError } from '../errors/not-found-error';
import { AttendanceRepository } from '../repositories/attendance-repository';
import { PayrollRunRepository } from '../repositories/payroll-run-repository';
import { PayrollLineRepository } from '../repositories/payroll-line-repository';

export const DEFAULT_UMK_2026 = 3701709;
const BASE_SALARY_RATIO = 0.6;

function daysInMonth(period: string): { from: string; to: string; workingDays: number } {
	const match = /^(\d{4})-(\d{2})$/.exec(period);
	if (!match) throw new ValidationError('Period must be YYYY-MM', { period: ['expected YYYY-MM'] });
	const year = Number(match[1]);
	const month = Number(match[2]);
	if (month < 1 || month > 12) throw new ValidationError('Invalid month in period', { period: ['month 01-12'] });
	const last = new Date(year, month, 0).getDate();
	let workingDays = 0;
	for (let d = 1; d <= last; d++) {
		const dow = new Date(year, month - 1, d).getDay();
		if (dow !== 0) workingDays += 1; // 6-day week, Sundays off
	}
	const pad = (n: number) => String(n).padStart(2, '0');
	return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${last}`, workingDays };
}

export class PayrollService {
	constructor(
		private attendanceRepo: AttendanceRepository,
		private payrollRunRepo: PayrollRunRepository,
		private payrollLineRepo: PayrollLineRepository,
	) {}

	/**
	 * Prepare a payroll run: one line per user with base salary pro-rated
	 * by attendance + piece-rate. Run starts as DRAFT.
	 */
	async prepareRun(
		tenantId: number,
		period: string,
		umkIdr: number,
		entries: Array<{ userId: number; pieceWeightKg: number; pieceRatePerKg: number }>,
	): Promise<{ runId: number; lines: number }> {
		const existing = await this.payrollRunRepo.findByPeriod(period, tenantId);
		if (existing) {
			throw new ValidationError('Payroll run already exists for period', { period: ['duplicate period'] });
		}
		if (!Number.isInteger(umkIdr) || umkIdr <= 0) {
			throw new ValidationError('UMK must be a positive integer', { umkIdr: ['must be positive integer'] });
		}
		const { from, to, workingDays } = daysInMonth(period);
		const run = await this.payrollRunRepo.create({ period, umkIdr, status: 'DRAFT' } as never, tenantId);
		const runId = (run as { id: number }).id;
		for (const e of entries) {
			const present = await this.attendanceRepo.countPresent(e.userId, tenantId, from, to);
			const baseSalaryIdr = Math.round(umkIdr * BASE_SALARY_RATIO * (workingDays > 0 ? present / workingDays : 0));
			const totalIdr = baseSalaryIdr + Math.round(e.pieceWeightKg * e.pieceRatePerKg);
			await this.payrollLineRepo.create(
				{ payrollRunId: runId, userId: e.userId, baseSalaryIdr, pieceWeightKg: String(e.pieceWeightKg), pieceRatePerKg: e.pieceRatePerKg, totalIdr } as never,
				tenantId,
			);
		}
		return { runId, lines: entries.length };
	}

	async approveRun(runId: number, tenantId: number): Promise<void> {
		const run = await this.payrollRunRepo.findById(runId, tenantId);
		if (!run) throw new NotFoundError('Payroll run not found');
		if ((run as { status: string }).status !== 'DRAFT') {
			throw new ValidationError('Only DRAFT runs can be approved', { status: ['expected DRAFT'] });
		}
		await this.payrollRunRepo.update(runId, { status: 'APPROVED' } as never, tenantId);
	}

	async getRunLines(runId: number, tenantId: number): Promise<unknown[]> {
		const run = await this.payrollRunRepo.findById(runId, tenantId);
		if (!run) throw new NotFoundError('Payroll run not found');
		return this.payrollLineRepo.findByRun(runId, tenantId);
	}
}
