import { AppError } from '../errors/app-error';
import { ValidationError } from '../errors/validation-error';
import { ConflictError } from '../errors/conflict-error';
import { TenantRepository } from '../repositories/tenant-repository';
import type { Tenant, NewTenant } from '@recycle-app/db';

export class TenantService {
	constructor(private tenantRepo: TenantRepository) {}

	async create(data: Partial<NewTenant>): Promise<Tenant> {
		if (!data.name || !data.type || !data.slug) {
			throw new ValidationError('Missing required fields', {
				name: !data.name ? ['name is required'] : [],
				type: !data.type ? ['type is required'] : [],
				slug: !data.slug ? ['slug is required'] : [],
			});
		}
		const existing = await this.tenantRepo.findBySlug(data.slug, 0);
		if (existing) {
			throw new ConflictError(`Tenant with slug "${data.slug}" already exists`);
		}
		return this.tenantRepo.create(data, 0);
	}

	async findById(id: number, tenantId: number): Promise<Tenant> {
		const tenant = await this.tenantRepo.findById(id, tenantId);
		if (!tenant) {
			throw new AppError('Tenant not found', 'NOT_FOUND', 404);
		}
		return tenant;
	}

	async findAll(tenantId: number): Promise<Tenant[]> {
		return this.tenantRepo.findAll(tenantId);
	}

	async update(id: number, data: Partial<Tenant>, tenantId: number): Promise<Tenant> {
		const existing = await this.tenantRepo.findById(id, tenantId);
		if (!existing) {
			throw new AppError('Tenant not found', 'NOT_FOUND', 404);
		}
		return this.tenantRepo.update(id, data, tenantId);
	}

	async delete(id: number, tenantId: number): Promise<void> {
		const existing = await this.tenantRepo.findById(id, tenantId);
		if (!existing) {
			throw new AppError('Tenant not found', 'NOT_FOUND', 404);
		}
		await this.tenantRepo.delete(id, tenantId);
	}
}
