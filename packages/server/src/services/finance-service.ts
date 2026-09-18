import { AppError } from '../errors/app-error';
import { ValidationError } from '../errors/validation-error';
import { NotFoundError } from '../errors/not-found-error';
import { TransactionRepository } from '../repositories/transaction-repository';
import { TransactionItemRepository } from '../repositories/transaction-item-repository';
import { LedgerRepository } from '../repositories/ledger-repository';
import { CustomerRepository } from '../repositories/customer-repository';
import { FactoryRepository } from '../repositories/factory-repository';
import { FactoryPriceQuoteRepository } from '../repositories/factory-price-quote-repository';
import { ProductionLogRepository } from '../repositories/production-log-repository';
import type { Ledger } from '@recycle-app/db';

const UMK_SEMARANG_2026 = 3701709;
const BASE_SALARY_RATIO = 0.6;
const PROFIT_SPLIT_RATIO = 0.5;

export class FinanceService {
	constructor(
		private transactionRepo: TransactionRepository,
		private transactionItemRepo: TransactionItemRepository,
		private ledgerRepo: LedgerRepository,
		private customerRepo: CustomerRepository,
		private factoryRepo: FactoryRepository,
		private factoryPriceQuoteRepo: FactoryPriceQuoteRepository,
		private productionLogRepo: ProductionLogRepository,
	) {}

	async supplierDebtDeduction(transactionId: number, tenantId: number, outstandingDebtIdr: number): Promise<{ netTotalIdr: number; deductedAmount: number; originalTotal: number }> {
		const txn = await this.transactionRepo.findById(transactionId, tenantId);
		if (!txn) {
			throw new NotFoundError('Transaction not found');
		}
		if (txn.type !== 'INBOUND') {
			throw new ValidationError('Supplier debt deduction only applies to INBOUND transactions', {
				type: [`Expected INBOUND, got ${txn.type}`],
			});
		}
		const deductedAmount = Math.min(outstandingDebtIdr, txn.totalIdr ?? 0);
		const netTotalIdr = (txn.totalIdr ?? 0) - deductedAmount;
		return {
			netTotalIdr,
			deductedAmount,
			originalTotal: txn.totalIdr ?? 0,
		};
	}

	async payroll(weightKg: number, ratePerKg: number): Promise<{ baseSalary: number; pieceRate: number; total: number }> {
		const baseSalary = Math.round(UMK_SEMARANG_2026 * BASE_SALARY_RATIO);
		const pieceRate = Math.round(weightKg * ratePerKg);
		const total = baseSalary + pieceRate;
		return { baseSalary, pieceRate, total };
	}

	async profitSplit(factoryRevenueIdr: number, hppBeliIdr: number, operationalIdr: number): Promise<{ netProfit: number; ownerShare: number; partnerShare: number }> {
		if (factoryRevenueIdr < 0 || hppBeliIdr < 0 || operationalIdr < 0) {
			throw new ValidationError('All financial values must be non-negative', {
				factoryRevenueIdr: factoryRevenueIdr < 0 ? ['must be non-negative'] : [],
				hppBeliIdr: hppBeliIdr < 0 ? ['must be non-negative'] : [],
				operationalIdr: operationalIdr < 0 ? ['must be non-negative'] : [],
			});
		}
		const netProfit = factoryRevenueIdr - hppBeliIdr - operationalIdr;
		const ownerShare = Math.round(netProfit * PROFIT_SPLIT_RATIO);
		const partnerShare = netProfit - ownerShare;
		return { netProfit, ownerShare, partnerShare };
	}

	async recordLedger(tenantId: number, type: string, amountIdr: number, balanceAfterIdr: number, referenceId?: string): Promise<void> {
		const ledgerData: Partial<Ledger> = { type: type as Ledger['type'], amountIdr, balanceAfterIdr, referenceId };
		await this.ledgerRepo.create(ledgerData as unknown as Parameters<typeof this.ledgerRepo.create>[0], tenantId);
	}

	/**
	 * Append a ledger entry with balance computed inside a DB transaction
	 * (row-locked read of latest balance + insert). Falls back to a
	 * best-effort read-then-write when the adapter lacks transactions.
	 */
	async appendLedger(
		db: { transaction?: <T>(fn: (tx: import('../repositories/base-repository').DB) => Promise<T>) => Promise<T> },
		tenantId: number,
		type: string,
		amountIdr: number,
		referenceId?: string,
		metadata?: Record<string, unknown>,
	): Promise<Ledger> {
		const write = async (conn: import('../repositories/base-repository').DB): Promise<Ledger> => {
			const repo = new LedgerRepository(conn);
			const recent = await repo.findRecent(tenantId, 1);
			const lastBalance = recent[0]?.balanceAfterIdr ?? 0;
			const sign = type === 'CASH_OUT' ? -1 : 1;
			return repo.create(
				{ type: type as Ledger['type'], amountIdr, balanceAfterIdr: lastBalance + sign * amountIdr, referenceId, metadata } as unknown as Parameters<LedgerRepository['create']>[0],
				tenantId,
			);
		};
		if (db.transaction) return db.transaction(write);
		const { createPgAdapter, databaseUrl } = await import('../db/pg-adapter');
		const adapter = createPgAdapter(databaseUrl());
		try {
			return await write(adapter.db);
		} finally {
			await adapter.close();
		}
	}
}
