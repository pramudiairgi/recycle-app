import { ValidationError } from '../errors/validation-error';
import { ConflictError } from '../errors/conflict-error';
import { NotFoundError } from '../errors/not-found-error';
import { FactoryPriceQuoteRepository } from '../repositories/factory-price-quote-repository';

function overlaps(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): boolean {
	return aFrom <= bTo && bFrom <= aTo;
}

export class QuoteService {
	constructor(private quoteRepo: FactoryPriceQuoteRepository) {}

	/**
	 * Accept a quote. Enforces the one-accepted rule: at most one accepted
	 * quote per (factory, category, overlapping validity period).
	 */
	async acceptQuote(quoteId: number, tenantId: number): Promise<unknown> {
		const quote = await this.quoteRepo.findById(quoteId, tenantId);
		if (!quote) throw new NotFoundError('Quote not found');
		const q = quote as unknown as {
			factoryId: number;
			categoryId: number;
			validFrom: string;
			validTo: string;
			isAccepted: boolean;
		};
		if (q.isAccepted) return quote;
		if (!q.validFrom || !q.validTo) {
			throw new ValidationError('Quote requires validFrom and validTo', { validFrom: ['required'] });
		}
		const now = new Date();
		if (new Date(q.validTo) < now) {
			throw new ValidationError('Cannot accept an expired quote', { validTo: ['quote expired'] });
		}
		const accepted = await this.quoteRepo.findAccepted(tenantId);
		for (const other of accepted as unknown as Array<typeof q & { id: number }>) {
			if (
				other.factoryId === q.factoryId &&
				other.categoryId === q.categoryId &&
				overlaps(new Date(q.validFrom), new Date(q.validTo), new Date(other.validFrom), new Date(other.validTo))
			) {
				throw new ConflictError(`Overlapping accepted quote exists (id ${other.id}) — revoke it first`);
			}
		}
		return this.quoteRepo.update(quoteId, { isAccepted: true } as never, tenantId);
	}

	async revokeQuote(quoteId: number, tenantId: number): Promise<unknown> {
		const quote = await this.quoteRepo.findById(quoteId, tenantId);
		if (!quote) throw new NotFoundError('Quote not found');
		return this.quoteRepo.update(quoteId, { isAccepted: false } as never, tenantId);
	}

	/** Active (unexpired) quotes for a category, newest first. */
	async listActive(categoryId: number, tenantId: number): Promise<unknown[]> {
		const quotes = await this.quoteRepo.findByCategory(categoryId, tenantId);
		const now = new Date();
		return (quotes as unknown as Array<{ validTo: string }>).filter((q) => new Date(q.validTo) >= now);
	}
}
