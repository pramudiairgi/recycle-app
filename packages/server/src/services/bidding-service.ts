import { AppError } from '../errors/app-error';
import { ValidationError } from '../errors/validation-error';
import { NotFoundError } from '../errors/not-found-error';
import { FactoryRepository } from '../repositories/factory-repository';
import { FactoryPriceQuoteRepository } from '../repositories/factory-price-quote-repository';
import { ProductionLogRepository } from '../repositories/production-log-repository';
import { CategoryRepository } from '../repositories/category-repository';

export class BiddingService {
	constructor(
		private factoryRepo: FactoryRepository,
		private factoryPriceQuoteRepo: FactoryPriceQuoteRepository,
		private productionLogRepo: ProductionLogRepository,
		private categoryRepo: CategoryRepository,
	) {}

	async calculateShrinkage(grossWeightKg: number, netWeightKg: number): Promise<{ shrinkageKg: number; shrinkagePercent: number; isAcceptable: boolean }> {
		if (grossWeightKg < 0 || netWeightKg < 0) {
			throw new ValidationError('Weights must be non-negative', {
				grossWeightKg: grossWeightKg < 0 ? ['must be non-negative'] : [],
				netWeightKg: netWeightKg < 0 ? ['must be non-negative'] : [],
			});
		}
		if (netWeightKg > grossWeightKg) {
			throw new ValidationError('Net weight cannot exceed gross weight', {
				netWeightKg: ['cannot exceed gross weight'],
			});
		}
		const shrinkageKg = grossWeightKg - netWeightKg;
		const shrinkagePercent = grossWeightKg > 0 ? (shrinkageKg / grossWeightKg) * 100 : 0;
		const isAcceptable = shrinkagePercent <= 10;
		return { shrinkageKg, shrinkagePercent, isAcceptable };
	}

	async rankFactories(tenantId: number, categoryId: number, tonStock: number): Promise<Array<{ factoryId: number; factoryName: string; pricePerKg: number; estimatedRouteCostIdr: number; netMargin: number; rank: number }>> {
		const factories = await this.factoryRepo.findActive(tenantId);
		const quotes = await this.factoryPriceQuoteRepo.findByCategory(categoryId, tenantId);
		const quoteMap = new Map<number, number>();
		for (const quote of quotes) {
			if (quote.factoryId != null && quote.pricePerKg != null) {
				quoteMap.set(quote.factoryId, quote.pricePerKg);
			}
		}

		const ranked = factories.map((factory) => {
			const pricePerKg = quoteMap.get(factory.id) ?? 0;
			const estimatedRouteCostIdr = factory.estimatedRouteCostIdr ?? 0;
			const netMargin = (tonStock * pricePerKg) - estimatedRouteCostIdr;
			return {
				factoryId: factory.id,
				factoryName: factory.name,
				pricePerKg,
				estimatedRouteCostIdr,
				netMargin,
				rank: 0,
			};
		});

		ranked.sort((a, b) => b.netMargin - a.netMargin);
		ranked.forEach((item, i) => {
			item.rank = i + 1;
		});
		return ranked;
	}

	async getTopFactory(tenantId: number, categoryId: number, tonStock: number): Promise<{ factoryId: number; factoryName: string; netMargin: number } | null> {
		const ranked = await this.rankFactories(tenantId, categoryId, tonStock);
		if (ranked.length === 0) {
			return null;
		}
		const top = ranked[0];
		return { factoryId: top.factoryId, factoryName: top.factoryName, netMargin: top.netMargin };
	}

	async acceptQuote(quoteId: number, tenantId: number): Promise<void> {
		const quote = await this.factoryPriceQuoteRepo.findById(quoteId, tenantId);
		if (!quote) {
			throw new NotFoundError('Factory price quote not found');
		}
		await this.factoryPriceQuoteRepo.update(quoteId, { isAccepted: true }, tenantId);
	}

	async rejectQuote(quoteId: number, tenantId: number): Promise<void> {
		const quote = await this.factoryPriceQuoteRepo.findById(quoteId, tenantId);
		if (!quote) {
			throw new NotFoundError('Factory price quote not found');
		}
		await this.factoryPriceQuoteRepo.update(quoteId, { isAccepted: false }, tenantId);
	}
}
