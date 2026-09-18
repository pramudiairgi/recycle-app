import { Container } from './container';
import * as tokens from './tokens';
import type { DB } from '../repositories/base-repository';
import { TenantRepository } from '../repositories/tenant-repository';
import { UserRepository } from '../repositories/user-repository';
import { CustomerRepository } from '../repositories/customer-repository';
import { CategoryRepository } from '../repositories/category-repository';
import { TransactionRepository } from '../repositories/transaction-repository';
import { TransactionItemRepository } from '../repositories/transaction-item-repository';
import { LedgerRepository } from '../repositories/ledger-repository';
import { ProductionLogRepository } from '../repositories/production-log-repository';
import { FactoryRepository } from '../repositories/factory-repository';
import { FactoryPriceQuoteRepository } from '../repositories/factory-price-quote-repository';
import { StockLotRepository } from '../repositories/stock-lot-repository';
import { AttendanceRepository } from '../repositories/attendance-repository';
import { PayrollRunRepository } from '../repositories/payroll-run-repository';
import { PayrollLineRepository } from '../repositories/payroll-line-repository';
import { TenantService } from '../services/tenant-service';
import { TransactionService } from '../services/transaction-service';
import { FinanceService } from '../services/finance-service';
import { BiddingService } from '../services/bidding-service';
import { StockLotService } from '../services/stock-lot-service';
import { PayrollService } from '../services/payroll-service';
import { IdempotentSyncService } from '../services/idempotent-sync-service';
import { QuoteService } from '../services/quote-service';

export function buildContainer(db: DB): Container {
	const c = new Container();
	c.register(tokens.TENANT_REPO, async () => new TenantRepository(db));
	c.register(tokens.USER_REPO, async () => new UserRepository(db));
	c.register(tokens.CUSTOMER_REPO, async () => new CustomerRepository(db));
	c.register(tokens.CATEGORY_REPO, async () => new CategoryRepository(db));
	c.register(tokens.TRANSACTION_REPO, async () => new TransactionRepository(db));
	c.register(tokens.TRANSACTION_ITEM_REPO, async () => new TransactionItemRepository(db));
	c.register(tokens.LEDGER_REPO, async () => new LedgerRepository(db));
	c.register(tokens.PRODUCTION_LOG_REPO, async () => new ProductionLogRepository(db));
	c.register(tokens.FACTORY_REPO, async () => new FactoryRepository(db));
	c.register(tokens.FACTORY_PRICE_QUOTE_REPO, async () => new FactoryPriceQuoteRepository(db));
	c.register(tokens.STOCK_LOT_REPO, async () => new StockLotRepository(db));
	c.register(tokens.ATTENDANCE_REPO, async () => new AttendanceRepository(db));
	c.register(tokens.PAYROLL_RUN_REPO, async () => new PayrollRunRepository(db));
	c.register(tokens.PAYROLL_LINE_REPO, async () => new PayrollLineRepository(db));
	c.register(tokens.TENANT_SERVICE, async () => new TenantService(await c.resolve(tokens.TENANT_REPO)));
	c.register(
		tokens.TRANSACTION_SERVICE,
		async () =>
			new TransactionService(
				await c.resolve(tokens.TRANSACTION_REPO),
				await c.resolve(tokens.TRANSACTION_ITEM_REPO),
				await c.resolve(tokens.LEDGER_REPO),
			),
	);
	c.register(
		tokens.FINANCE_SERVICE,
		async () =>
			new FinanceService(
				await c.resolve(tokens.TRANSACTION_REPO),
				await c.resolve(tokens.TRANSACTION_ITEM_REPO),
				await c.resolve(tokens.LEDGER_REPO),
				await c.resolve(tokens.CUSTOMER_REPO),
				await c.resolve(tokens.FACTORY_REPO),
				await c.resolve(tokens.FACTORY_PRICE_QUOTE_REPO),
				await c.resolve(tokens.PRODUCTION_LOG_REPO),
			),
	);
	c.register(
		tokens.BIDDING_SERVICE,
		async () =>
			new BiddingService(
				await c.resolve(tokens.FACTORY_REPO),
				await c.resolve(tokens.FACTORY_PRICE_QUOTE_REPO),
				await c.resolve(tokens.PRODUCTION_LOG_REPO),
				await c.resolve(tokens.CATEGORY_REPO),
			),
	);
	c.register(tokens.STOCK_LOT_SERVICE, async () => new StockLotService(await c.resolve(tokens.STOCK_LOT_REPO)));
	c.register(
		tokens.PAYROLL_SERVICE,
		async () =>
			new PayrollService(
				await c.resolve(tokens.ATTENDANCE_REPO),
				await c.resolve(tokens.PAYROLL_RUN_REPO),
				await c.resolve(tokens.PAYROLL_LINE_REPO),
			),
	);
	c.register(
		tokens.SYNC_SERVICE,
		async () =>
			new IdempotentSyncService(await c.resolve(tokens.TRANSACTION_REPO), await c.resolve(tokens.TRANSACTION_ITEM_REPO)),
	);
	c.register(tokens.QUOTE_SERVICE, async () => new QuoteService(await c.resolve(tokens.FACTORY_PRICE_QUOTE_REPO)));
	return c;
}
