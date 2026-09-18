import { ValidationError } from '../errors/validation-error';
import { TransactionRepository } from '../repositories/transaction-repository';
import { TransactionItemRepository } from '../repositories/transaction-item-repository';

export const OFFLINE_FUTURE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const OFFLINE_PAST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface SyncItem {
	categoryId: number;
	weightKg: number;
	appliedPriceIdr: number;
	subtotalIdr: number;
}

export interface SyncPayload {
	customerId?: number;
	type: 'INBOUND' | 'OUTBOUND';
	totalIdr: number;
	proofPhotoUrl?: string;
	offlineTimestamp: string; // ISO from device
	clientMutationId: string; // UUID v4 from device
	factoryId?: number;
	acceptedQuoteId?: number;
	items: SyncItem[];
}

export class IdempotentSyncService {
	constructor(
		private transactionRepo: TransactionRepository,
		private transactionItemRepo: TransactionItemRepository,
	) {}

	/**
	 * Idempotent offline sync: duplicate (tenantId, clientMutationId)
	 * returns the existing row with `duplicate: true` — never a second row.
	 * Price lock values are preserved verbatim from the device.
	 */
	async sync(payload: SyncPayload, tenantId: number): Promise<{ transaction: unknown; duplicate: boolean }> {
		if (!payload.clientMutationId) {
			throw new ValidationError('clientMutationId is required', { clientMutationId: ['required'] });
		}
		const existing = await this.transactionRepo.findByClientMutationId(payload.clientMutationId, tenantId);
		if (existing) return { transaction: existing, duplicate: true };

		const offlineMs = Date.parse(payload.offlineTimestamp);
		if (Number.isNaN(offlineMs)) {
			throw new ValidationError('offlineTimestamp must be ISO datetime', { offlineTimestamp: ['invalid datetime'] });
		}
		const drift = offlineMs - Date.now();
		if (drift > OFFLINE_FUTURE_WINDOW_MS) {
			throw new ValidationError('offlineTimestamp is too far in the future', {
				offlineTimestamp: ['exceeds +24h window — check device clock'],
			});
		}
		if (-drift > OFFLINE_PAST_WINDOW_MS) {
			throw new ValidationError('offlineTimestamp is too old', {
				offlineTimestamp: ['older than 30 days — requires OWNER override'],
			});
		}
		if (payload.type === 'OUTBOUND' && (payload.factoryId == null || payload.acceptedQuoteId == null)) {
			throw new ValidationError('OUTBOUND requires factoryId and acceptedQuoteId', {
				factoryId: payload.factoryId == null ? ['required for OUTBOUND'] : [],
				acceptedQuoteId: payload.acceptedQuoteId == null ? ['required for OUTBOUND'] : [],
			});
		}

		const transaction = await this.transactionRepo.create(
			{
				customerId: payload.customerId,
				type: payload.type,
				status: 'SYNCED',
				clientMutationId: payload.clientMutationId,
				factoryId: payload.factoryId,
				acceptedQuoteId: payload.acceptedQuoteId,
				totalIdr: payload.totalIdr,
				proofPhotoUrl: payload.proofPhotoUrl,
				offlineTimestamp: new Date(offlineMs),
				serverTimestamp: new Date(),
			} as never,
			tenantId,
		);
		const txnId = (transaction as { id: number }).id;
		for (const item of payload.items) {
			await this.transactionItemRepo.create(
				{
					transactionId: txnId,
					categoryId: item.categoryId,
					weightKg: String(item.weightKg),
					appliedPriceIdr: item.appliedPriceIdr,
					subtotalIdr: item.subtotalIdr,
				} as never,
				tenantId,
			);
		}
		return { transaction, duplicate: false };
	}
}
