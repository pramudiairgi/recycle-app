import { Container } from '../di/container';
import * as tokens from '../di/tokens';
import { ValidationError } from '../errors/validation-error';
import { NotFoundError } from '../errors/not-found-error';
import { UnauthorizedError } from '../errors/unauthorized-error';
import { signJwt } from '../auth/jwt';
import { verifyPassword } from '../auth/password';
import { addRoute, type Handler } from '../http/router';
import { ok } from '../http/envelope';
import { RATE_LIMITS } from '../http/rate-limit';
import { registerCrud, type CrudRepo } from '../http/crud';
import type { UserRepository } from '../repositories/user-repository';
import type { TransactionRepository } from '../repositories/transaction-repository';
import type { TransactionItemRepository } from '../repositories/transaction-item-repository';
import type { CustomerRepository } from '../repositories/customer-repository';
import type { LedgerRepository } from '../repositories/ledger-repository';
import type { TransactionService } from '../services/transaction-service';
import type { FinanceService } from '../services/finance-service';
import type { BiddingService } from '../services/bidding-service';
import type { StockLotService } from '../services/stock-lot-service';
import type { PayrollService } from '../services/payroll-service';
import type { IdempotentSyncService } from '../services/idempotent-sync-service';
import type { QuoteService } from '../services/quote-service';

const ADMIN: 'admin:all' = 'admin:all';

async function readJson(req: Request): Promise<Record<string, unknown>> {
	try {
		const body = (await req.json()) as unknown;
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			throw new ValidationError('Request body must be a JSON object', { body: ['must be object'] });
		}
		return body as Record<string, unknown>;
	} catch (err) {
		if (err instanceof ValidationError) throw err;
		throw new ValidationError('Malformed JSON body', { body: ['invalid JSON'] });
	}
}

export function registerV1(c: Container, jwtSecret: string): void {
	const repo = <T>(token: string): Promise<CrudRepo<T>> => c.resolve<CrudRepo<T>>(token);

	// --- Auth: login (public) ---
	const login: Handler = async (req) => {
		const body = await readJson(req);
		if (typeof body.email !== 'string' || typeof body.password !== 'string') {
			throw new ValidationError('email and password are required', { email: ['required'], password: ['required'] });
		}
		const userRepo = await c.resolve<UserRepository>(tokens.USER_REPO);
		const user = (await userRepo.findByEmailAny(body.email)) as unknown as {
			id: number;
			tenantId: number;
			role: string;
			passwordHash: string;
		} | null;
		if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
			throw new UnauthorizedError('Invalid email or password');
		}
		const token = await signJwt({ sub: user.id, tenantId: user.tenantId, role: user.role }, jwtSecret, 12 * 3600);
		return ok({ token, user: { id: user.id, tenantId: user.tenantId, role: user.role } });
	};
	addRoute('POST', '/api/v1/auth/login', login, { scope: null, ...RATE_LIMITS.auth });

	// --- Generic CRUD: 14 resources ---
	const defs: Array<{ prefix: string; token: string; read: Parameters<typeof registerCrud>[2]['readScope']; write: Parameters<typeof registerCrud>[2]['writeScope']; writable: boolean }> = [
		{ prefix: '/api/v1/tenants', token: tokens.TENANT_REPO, read: ADMIN, write: ADMIN, writable: true },
		{ prefix: '/api/v1/users', token: tokens.USER_REPO, read: 'transactions:read', write: ADMIN, writable: true },
		{ prefix: '/api/v1/customers', token: tokens.CUSTOMER_REPO, read: 'transactions:read', write: 'transactions:write', writable: true },
		{ prefix: '/api/v1/categories', token: tokens.CATEGORY_REPO, read: 'transactions:read', write: 'transactions:verify', writable: true },
		{ prefix: '/api/v1/transactions', token: tokens.TRANSACTION_REPO, read: 'transactions:read', write: 'transactions:write', writable: true },
		{ prefix: '/api/v1/transaction-items', token: tokens.TRANSACTION_ITEM_REPO, read: 'transactions:read', write: 'transactions:verify', writable: true },
		{ prefix: '/api/v1/ledgers', token: tokens.LEDGER_REPO, read: 'ledgers:read', write: 'ledgers:write', writable: false },
		{ prefix: '/api/v1/production-logs', token: tokens.PRODUCTION_LOG_REPO, read: 'transactions:read', write: 'transactions:verify', writable: true },
		{ prefix: '/api/v1/factories', token: tokens.FACTORY_REPO, read: 'transactions:read', write: 'factories:manage', writable: true },
		{ prefix: '/api/v1/factory-price-quotes', token: tokens.FACTORY_PRICE_QUOTE_REPO, read: 'transactions:read', write: 'factories:manage', writable: true },
		{ prefix: '/api/v1/stock-lots', token: tokens.STOCK_LOT_REPO, read: 'transactions:read', write: 'transactions:verify', writable: true },
		{ prefix: '/api/v1/attendances', token: tokens.ATTENDANCE_REPO, read: 'transactions:read', write: 'transactions:write', writable: true },
		{ prefix: '/api/v1/payroll-runs', token: tokens.PAYROLL_RUN_REPO, read: 'reports:read', write: 'payroll:prepare', writable: true },
		{ prefix: '/api/v1/payroll-lines', token: tokens.PAYROLL_LINE_REPO, read: 'reports:read', write: 'payroll:prepare', writable: false },
	];
	for (const d of defs) {
		const r = crudRepoProxy(c, d.token);
		registerCrud(d.prefix, r, { readScope: d.read, writeScope: d.write, writable: d.writable });
	}

	// --- Offline sync (idempotent) ---
	const sync: Handler = async (req, ctx) => {
		const body = await readJson(req);
		const svc = await c.resolve<IdempotentSyncService>(tokens.SYNC_SERVICE);
		const result = await svc.sync(
			{
				customerId: body.customerId as number | undefined,
				type: body.type as 'INBOUND' | 'OUTBOUND',
				totalIdr: body.totalIdr as number,
				proofPhotoUrl: body.proofPhotoUrl as string | undefined,
				offlineTimestamp: body.offlineTimestamp as string,
				clientMutationId: body.clientMutationId as string,
				factoryId: body.factoryId as number | undefined,
				acceptedQuoteId: body.acceptedQuoteId as number | undefined,
				items: (body.items ?? []) as Array<{ categoryId: number; weightKg: number; appliedPriceIdr: number; subtotalIdr: number }>,
			},
			ctx.tenantId,
		);
		return ok(result);
	};
	addRoute('POST', '/api/v1/transactions/sync', sync, { scope: 'transactions:write', ...RATE_LIMITS.sync });

	// --- Transaction lifecycle: verify (INBOUND settles kasbon) ---
	const verify: Handler = async (_req, ctx, params) => {
		const id = Number(params.id);
		const txnRepo = await c.resolve<TransactionRepository>(tokens.TRANSACTION_REPO);
		const txn = (await txnRepo.findById(id, ctx.tenantId)) as unknown as {
			status: string;
			type: string;
			totalIdr: number;
			customerId: number | null;
		} | null;
		if (!txn) throw new NotFoundError('Transaction not found');
		if (txn.status !== 'SYNCED' && txn.status !== 'DRAFT') {
			throw new ValidationError('Only DRAFT/SYNCED transactions can be verified', { status: [`got ${txn.status}`] });
		}
		let totalIdr = Number(txn.totalIdr ?? 0);
		if (txn.type === 'INBOUND' && txn.customerId != null) {
			const customerRepo = await c.resolve<CustomerRepository>(tokens.CUSTOMER_REPO);
			const customer = (await customerRepo.findById(txn.customerId, ctx.tenantId)) as unknown as { debtIdr: number } | null;
			const debt = Number(customer?.debtIdr ?? 0);
			const deducted = Math.min(debt, totalIdr);
			if (deducted > 0) {
				const finance = await c.resolve<FinanceService>(tokens.FINANCE_SERVICE);
				const { createPgAdapter, databaseUrl } = await import('../db/pg-adapter');
				const adapter = createPgAdapter(databaseUrl());
				try {
					await finance.appendLedger(adapter.db, ctx.tenantId, 'DEBT_PAY', deducted, String(id), { kind: 'kasbon-settle' });
				} finally {
					await adapter.close();
				}
				await customerRepo.update(txn.customerId, { debtIdr: debt - deducted } as never, ctx.tenantId);
				totalIdr -= deducted;
			}
		}
		const updated = await txnRepo.update(id, { status: 'VERIFIED', totalIdr } as never, ctx.tenantId);
		return ok(updated);
	};
	addRoute('POST', '/api/v1/transactions/:id/verify', verify, { scope: 'transactions:verify', ...RATE_LIMITS.read });

	// --- Complete: OUTBOUND consumes FIFO + CASH_IN; INBOUND creates lots + CASH_OUT ---
	const complete: Handler = async (_req, ctx, params) => {
		const id = Number(params.id);
		const txnRepo = await c.resolve<TransactionRepository>(tokens.TRANSACTION_REPO);
		const itemRepo = await c.resolve<TransactionItemRepository>(tokens.TRANSACTION_ITEM_REPO);
		const txn = (await txnRepo.findById(id, ctx.tenantId)) as unknown as {
			status: string;
			type: string;
			totalIdr: number;
		} | null;
		if (!txn) throw new NotFoundError('Transaction not found');
		if (txn.status !== 'VERIFIED') {
			throw new ValidationError('Only VERIFIED transactions can be completed', { status: [`got ${txn.status}`] });
		}
		const finance = await c.resolve<FinanceService>(tokens.FINANCE_SERVICE);
		const { createPgAdapter, databaseUrl } = await import('../db/pg-adapter');
		const adapter = createPgAdapter(databaseUrl());
		try {
			const items = (await itemRepo.findByTransaction(id, ctx.tenantId)) as unknown as Array<{
				categoryId: number;
				weightKg: string | number;
				appliedPriceIdr: number;
			}>;
			if (txn.type === 'OUTBOUND') {
				const stock = await c.resolve<StockLotService>(tokens.STOCK_LOT_SERVICE);
				let hpp = 0;
				for (const item of items) {
					const consumed = await stock.consumeFIFO(ctx.tenantId, item.categoryId, Number(item.weightKg));
					hpp += consumed.totalHppIdr;
				}
				await finance.appendLedger(adapter.db, ctx.tenantId, 'CASH_IN', Number(txn.totalIdr ?? 0), String(id), { hppIdr: hpp });
			} else {
				const stock = await c.resolve<StockLotService>(tokens.STOCK_LOT_SERVICE);
				for (const item of items) {
					await stock.addLot(ctx.tenantId, item.categoryId, Number(item.weightKg), Number(item.appliedPriceIdr ?? 0));
				}
				await finance.appendLedger(adapter.db, ctx.tenantId, 'CASH_OUT', Number(txn.totalIdr ?? 0), String(id), { kind: 'inbound-payout' });
			}
		} finally {
			await adapter.close();
		}
		const updated = await txnRepo.update(id, { status: 'COMPLETED' } as never, ctx.tenantId);
		return ok(updated);
	};
	addRoute('POST', '/api/v1/transactions/:id/complete', complete, { scope: 'transactions:verify', ...RATE_LIMITS.read });

	// --- Cancel with reason ---
	const cancel: Handler = async (req, ctx, params) => {
		const id = Number(params.id);
		const body = await readJson(req);
		if (typeof body.reason !== 'string' || body.reason.trim() === '') {
			throw new ValidationError('Cancellation reason is required', { reason: ['required'] });
		}
		const txnSvc = await c.resolve<TransactionService>(tokens.TRANSACTION_SERVICE);
		const txn = (await txnSvc.findById(id, ctx.tenantId)) as unknown as { status: string };
		if (txn.status === 'COMPLETED') {
			throw new ValidationError('COMPLETED transactions cannot be cancelled', { status: ['terminal'] });
		}
		const txnRepo = await c.resolve<TransactionRepository>(tokens.TRANSACTION_REPO);
		const updated = await txnRepo.update(id, { status: 'CANCELLED' } as never, ctx.tenantId);
		return ok(updated);
	};
	addRoute('POST', '/api/v1/transactions/:id/cancel', cancel, { scope: 'transactions:verify', ...RATE_LIMITS.read });

	// --- Quotes: accept / revoke ---
	const acceptQuote: Handler = async (_req, ctx, params) => {
		const svc = await c.resolve<QuoteService>(tokens.QUOTE_SERVICE);
		return ok(await svc.acceptQuote(Number(params.id), ctx.tenantId));
	};
	addRoute('POST', '/api/v1/quotes/:id/accept', acceptQuote, { scope: 'factories:manage', ...RATE_LIMITS.read });
	const revokeQuote: Handler = async (_req, ctx, params) => {
		const svc = await c.resolve<QuoteService>(tokens.QUOTE_SERVICE);
		return ok(await svc.revokeQuote(Number(params.id), ctx.tenantId));
	};
	addRoute('POST', '/api/v1/quotes/:id/revoke', revokeQuote, { scope: 'factories:manage', ...RATE_LIMITS.read });

	// --- Bidding rank ---
	const rank: Handler = async (_req, ctx, _params, url) => {
		const categoryId = Number(url.searchParams.get('categoryId'));
		const tonStock = Number(url.searchParams.get('tonStock') ?? '0');
		if (!Number.isInteger(categoryId)) throw new ValidationError('categoryId is required', { categoryId: ['required'] });
		const bidding = await c.resolve<BiddingService>(tokens.BIDDING_SERVICE);
		return ok(await bidding.rankFactories(ctx.tenantId, categoryId, tonStock));
	};
	addRoute('GET', '/api/v1/bidding/rank', rank, { scope: 'transactions:read', ...RATE_LIMITS.read });

	// --- Stock ---
	const available: Handler = async (_req, ctx, _params, url) => {
		const categoryId = Number(url.searchParams.get('categoryId'));
		if (!Number.isInteger(categoryId)) throw new ValidationError('categoryId is required', { categoryId: ['required'] });
		const stock = await c.resolve<StockLotService>(tokens.STOCK_LOT_SERVICE);
		return ok({ categoryId, availableKg: await stock.availableStock(ctx.tenantId, categoryId) });
	};
	addRoute('GET', '/api/v1/stock/available', available, { scope: 'transactions:read', ...RATE_LIMITS.read });
	const consume: Handler = async (req, ctx) => {
		const body = await readJson(req);
		if (!Number.isInteger(body.categoryId as number) || typeof body.weightKg !== 'number') {
			throw new ValidationError('categoryId and weightKg are required', { categoryId: ['required'], weightKg: ['required'] });
		}
		const stock = await c.resolve<StockLotService>(tokens.STOCK_LOT_SERVICE);
		return ok(await stock.consumeFIFO(ctx.tenantId, body.categoryId as number, body.weightKg as number));
	};
	addRoute('POST', '/api/v1/stock/consume', consume, { scope: 'transactions:verify', ...RATE_LIMITS.read });

	// --- Payroll ---
	const preparePayroll: Handler = async (req, ctx) => {
		const body = await readJson(req);
		if (typeof body.period !== 'string' || typeof body.umkIdr !== 'number' || !Array.isArray(body.entries)) {
			throw new ValidationError('period, umkIdr and entries are required', { period: ['required'], umkIdr: ['required'], entries: ['required'] });
		}
		const payroll = await c.resolve<PayrollService>(tokens.PAYROLL_SERVICE);
		return ok(
			await payroll.prepareRun(ctx.tenantId, body.period, body.umkIdr, body.entries as Array<{ userId: number; pieceWeightKg: number; pieceRatePerKg: number }>),
			201,
		);
	};
	addRoute('POST', '/api/v1/payroll/prepare', preparePayroll, { scope: 'payroll:prepare', ...RATE_LIMITS.read });
	const approvePayroll: Handler = async (_req, ctx, params) => {
		const payroll = await c.resolve<PayrollService>(tokens.PAYROLL_SERVICE);
		await payroll.approveRun(Number(params.id), ctx.tenantId);
		return ok({ approved: true });
	};
	addRoute('POST', '/api/v1/payroll/runs/:id/approve', approvePayroll, { scope: 'payroll:approve', ...RATE_LIMITS.read });
}

/** Lazy repo proxy: resolves the real repository from the container on first use. */
function crudRepoProxy(c: Container, token: string): CrudRepo<never> {
	let real: CrudRepo<never> | null = null;
	const get = async (): Promise<CrudRepo<never>> => {
		if (!real) real = await c.resolve<CrudRepo<never>>(token);
		return real;
	};
	return {
		findAll: (t) => get().then((r) => r.findAll(t)),
		findById: (id, t) => get().then((r) => r.findById(id, t)),
		create: (d, t) => get().then((r) => r.create(d, t)),
		update: (id, d, t) => get().then((r) => r.update(id, d, t)),
		delete: (id, t) => get().then((r) => r.delete(id, t)),
	};
}
