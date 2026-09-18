import { describe, it, expect } from 'bun:test';
import { FinanceService } from './finance-service';
import { BiddingService } from './bidding-service';

const finance = new FinanceService(null as never, null as never, null as never, null as never, null as never, null as never, null as never);
const bidding = new BiddingService(null as never, null as never, null as never, null as never);

describe('FinanceService.payroll', () => {
	it('computes base 60% UMK 2026 + piece-rate', async () => {
		const result = await finance.payroll(100, 500);
		expect(result.baseSalary).toBe(2221025); // round(3701709 * 0.6)
		expect(result.pieceRate).toBe(50000);
		expect(result.total).toBe(2271025);
	});
});

describe('FinanceService.profitSplit', () => {
	it('splits 50/50 with remainder to partner', async () => {
		const result = await finance.profitSplit(1000001, 400000, 100000);
		expect(result.netProfit).toBe(500001);
		expect(result.ownerShare + result.partnerShare).toBe(500001);
		expect(result.ownerShare).toBe(Math.round(500001 * 0.5));
	});

	it('supports the loss path (negative net profit)', async () => {
		const result = await finance.profitSplit(100000, 400000, 100000);
		expect(result.netProfit).toBe(-400000);
		expect(result.ownerShare).toBe(-200000);
		expect(result.partnerShare).toBe(-200000);
	});

	it('rejects negative inputs', async () => {
		await expect(finance.profitSplit(-1, 0, 0)).rejects.toThrow();
	});
});

describe('FinanceService.supplierDebtDeduction', () => {
	it('caps deduction at transaction total', async () => {
		const repo = { findById: async () => ({ type: 'INBOUND', totalIdr: 300000 }) };
		const svc = new FinanceService(repo as never, null as never, null as never, null as never, null as never, null as never, null as never);
		const result = await svc.supplierDebtDeduction(1, 1, 500000);
		expect(result.deductedAmount).toBe(300000);
		expect(result.netTotalIdr).toBe(0);
	});
});

describe('BiddingService.calculateShrinkage', () => {
	it('computes shrinkage and 10% acceptability boundary', async () => {
		const ok = await bidding.calculateShrinkage(100, 90);
		expect(ok.shrinkageKg).toBe(10);
		expect(ok.shrinkagePercent).toBe(10);
		expect(ok.isAcceptable).toBe(true);
		const bad = await bidding.calculateShrinkage(100, 89);
		expect(bad.isAcceptable).toBe(false);
	});

	it('rejects net over gross', async () => {
		await expect(bidding.calculateShrinkage(90, 100)).rejects.toThrow();
	});
});
