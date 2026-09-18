import { ValidationError } from '../errors/validation-error';
import { StockLotRepository } from '../repositories/stock-lot-repository';

export interface LotDepletion {
	lotId: number;
	weightKg: number;
	hppPerKg: number;
	costIdr: number;
}

const num = (v: string | number | null | undefined): number => Number(v ?? 0);

export class StockLotService {
	constructor(private stockLotRepo: StockLotRepository) {}

	async addLot(
		tenantId: number,
		categoryId: number,
		weightKg: number,
		hppPerKg: number,
	): Promise<{ id: number }> {
		if (weightKg <= 0) {
			throw new ValidationError('Lot weight must be positive', { weightKg: ['must be positive'] });
		}
		if (!Number.isInteger(hppPerKg) || hppPerKg < 0) {
			throw new ValidationError('HPP per kg must be a non-negative integer', { hppPerKg: ['must be non-negative integer'] });
		}
		const lot = await this.stockLotRepo.create(
			{ categoryId, weightKg: String(weightKg), hppPerKg, consumedWeightKg: '0' } as never,
			tenantId,
		);
		return { id: (lot as { id: number }).id };
	}

	/** Remaining saleable stock (kg) for a category across all lots. */
	async availableStock(tenantId: number, categoryId: number): Promise<number> {
		const lots = await this.stockLotRepo.findAvailable(categoryId, tenantId);
		return lots.reduce((sum, lot) => sum + (num(lot.weightKg) - num(lot.consumedWeightKg)), 0);
	}

	/**
	 * FIFO consumption: deplete oldest lots first.
	 * Returns per-lot depletions + total HPP cost. Throws when stock insufficient.
	 */
	async consumeFIFO(
		tenantId: number,
		categoryId: number,
		weightKg: number,
	): Promise<{ depletions: LotDepletion[]; totalHppIdr: number }> {
		if (weightKg <= 0) {
			throw new ValidationError('Consumption weight must be positive', { weightKg: ['must be positive'] });
		}
		const lots = await this.stockLotRepo.findAvailable(categoryId, tenantId);
		let remaining = weightKg;
		const depletions: LotDepletion[] = [];
		for (const lot of lots) {
			if (remaining <= 0) break;
			const lotId = (lot as { id: number }).id;
			const free = num(lot.weightKg) - num(lot.consumedWeightKg);
			if (free <= 0) continue;
			const take = Math.min(free, remaining);
			const hppPerKg = (lot as { hppPerKg: number }).hppPerKg;
			await this.stockLotRepo.update(lotId, { consumedWeightKg: String(num(lot.consumedWeightKg) + take) } as never, tenantId);
			depletions.push({ lotId, weightKg: take, hppPerKg, costIdr: Math.round(take * hppPerKg) });
			remaining -= take;
		}
		if (remaining > 0) {
			throw new ValidationError('Insufficient stock for FIFO consumption', {
				weightKg: [`short by ${remaining} kg`],
			});
		}
		const totalHppIdr = depletions.reduce((sum, d) => sum + d.costIdr, 0);
		return { depletions, totalHppIdr };
	}
}
