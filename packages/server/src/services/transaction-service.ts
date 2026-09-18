import { AppError } from '../errors/app-error';
import { ValidationError } from '../errors/validation-error';
import { NotFoundError } from '../errors/not-found-error';
import { TransactionRepository } from '../repositories/transaction-repository';
import { TransactionItemRepository } from '../repositories/transaction-item-repository';
import { LedgerRepository } from '../repositories/ledger-repository';

interface OfflineTransactionItem {
	categoryId: number;
	weightKg: number;
	subtotalIdr: number;
}

interface OfflineTransactionData {
	customerId?: number;
	type?: string;
	totalIdr?: number;
	proofPhotoUrl?: string;
	items?: OfflineTransactionItem[];
	tenantId?: number;
}

export class TransactionService {
	constructor(
		private transactionRepo: TransactionRepository,
		private transactionItemRepo: TransactionItemRepository,
		private ledgerRepo: LedgerRepository,
	) {}

	async createFromOffline(data: OfflineTransactionData, appliedPriceIdr: number, offlineTimestamp: Date): Promise<any> {
		if (!data.customerId || !data.type) {
			throw new ValidationError('Missing required fields for offline transaction', {
				customerId: !data.customerId ? ['customerId is required'] : [],
				type: !data.type ? ['type is required'] : [],
			});
		}
		const transaction = await this.transactionRepo.create({
			customerId: data.customerId,
			type: data.type as any,
			status: 'DRAFT',
			totalIdr: data.totalIdr,
			proofPhotoUrl: data.proofPhotoUrl,
			offlineTimestamp: offlineTimestamp,
		} as any, data.tenantId ?? 0);

		if (data.items && data.items.length > 0) {
			for (const item of data.items) {
				await this.transactionItemRepo.create({
					categoryId: item.categoryId,
					transactionId: transaction.id,
					weightKg: item.weightKg,
					appliedPriceIdr: appliedPriceIdr,
					subtotalIdr: item.subtotalIdr,
				} as any, data.tenantId ?? 0);
			}
		}

		return transaction;
	}

	async syncTransaction(transactionId: number, tenantId: number): Promise<any> {
		const txn = await this.transactionRepo.findById(transactionId, tenantId);
		if (!txn) {
			throw new NotFoundError('Transaction not found');
		}
		if (txn.status !== 'DRAFT') {
			throw new ValidationError('Only DRAFT transactions can be synced', {
				status: [`Expected DRAFT, got ${txn.status}`],
			});
		}
		return this.transactionRepo.update(transactionId, { status: 'SYNCED' }, tenantId);
	}

	async transitionToPending(transactionId: number, tenantId: number): Promise<any> {
		const txn = await this.transactionRepo.findById(transactionId, tenantId);
		if (!txn) {
			throw new NotFoundError('Transaction not found');
		}
		if (txn.status === 'DRAFT') {
			await this.syncTransaction(transactionId, tenantId);
		}
		if (txn.status === 'SYNCED') {
			return this.transactionRepo.update(transactionId, { status: 'PENDING' }, tenantId);
		}
		throw new ValidationError('Cannot transition transaction to PENDING from current status', {
			status: [`Expected SYNCED or DRAFT, got ${txn.status}`],
		});
	}

	async findById(id: number, tenantId: number): Promise<any> {
		const txn = await this.transactionRepo.findById(id, tenantId);
		if (!txn) {
			throw new NotFoundError('Transaction not found');
		}
		return txn;
	}

	async findAll(tenantId: number): Promise<any[]> {
		return this.transactionRepo.findAll(tenantId);
	}

	async findOfflineUnsynced(tenantId: number): Promise<any[]> {
		return this.transactionRepo.findOfflineUnsynced(tenantId);
	}
}
