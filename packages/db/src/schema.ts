import { pgTable, serial, integer, text, timestamp, numeric, boolean, jsonb, uuid, date, pgEnum, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// --- Enums ---
export const tenantType = pgEnum('tenant_type', ['HUB', 'SPOKE']);
export const userRole = pgEnum('user_role', ['OWNER', 'PARTNER', 'DRIVER', 'WORKER', 'TENANT_ADMIN', 'ACCOUNTANT']);
export const transactionType = pgEnum('transaction_type', ['INBOUND', 'OUTBOUND']);
export const transactionStatus = pgEnum('transaction_status', ['DRAFT', 'SYNCED', 'VERIFIED', 'COMPLETED', 'PENDING', 'FAILED', 'CANCELLED']);
export const ledgerType = pgEnum('ledger_type', ['CASH_IN', 'CASH_OUT', 'DEBT_ADD', 'DEBT_PAY']);

// --- Tables ---
export const tenants = pgTable('tenants', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	type: tenantType('type').notNull(),
	slug: text('slug').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`).notNull(),
});

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	tenantId: integer('tenant_id').notNull().references(() => tenants.id),
	email: text('email').notNull(),
	passwordHash: text('password_hash').notNull(),
	role: userRole('role').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`).notNull(),
}, (t) => ({
	tenantIdx: index('users_tenant_idx').on(t.tenantId),
	userTenantRoleIdx: index('user_tenant_role_idx').on(t.tenantId, t.role),
}));

export const customers = pgTable('customers', {
	id: serial('id').primaryKey(),
	tenantId: integer('tenant_id').notNull().references(() => tenants.id),
	name: text('name').notNull(),
	phone: text('phone'),
	balanceIdr: integer('balance_idr').default(0),
	debtIdr: integer('debt_idr').default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`).notNull(),
}, (t) => ({
	tenantIdx: index('customers_tenant_idx').on(t.tenantId),
}));

export const categories = pgTable('categories', {
	id: serial('id').primaryKey(),
	tenantId: integer('tenant_id').notNull().references(() => tenants.id),
	name: text('name').notNull(),
	pricePerKg: integer('price_per_kg'),
	unit: text('unit'),
	isActive: boolean('is_active').default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`).notNull(),
}, (t) => ({
	tenantIdx: index('categories_tenant_idx').on(t.tenantId),
}));

export const transactions = pgTable('transactions', {
	id: serial('id').primaryKey(),
	tenantId: integer('tenant_id').notNull().references(() => tenants.id),
	customerId: integer('customer_id').references(() => customers.id),
	type: transactionType('type').notNull(),
	status: transactionStatus('status').notNull().default('DRAFT'),
	clientMutationId: uuid('client_mutation_id').notNull(), // IDEMPOTENCY: UUID from device, unique per tenant — duplicate sync returns existing row
	factoryId: integer('factory_id').references(() => factories.id), // OUTBOUND only: selling factory
	acceptedQuoteId: integer('accepted_quote_id').references(() => factoryPriceQuotes.id), // OUTBOUND only: accepted, unexpired quote
	offlineTimestamp: timestamp('offline_timestamp', { withTimezone: true }),
	serverTimestamp: timestamp('server_timestamp', { withTimezone: true }),
	totalIdr: integer('total_idr'),
	proofPhotoUrl: text('proof_photo_url'),
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`).notNull(),
}, (t) => ({
	tenantIdx: index('transactions_tenant_idx').on(t.tenantId),
	txnTenantTimeIdx: index('txn_tenant_time_idx').on(t.tenantId, t.offlineTimestamp),
	txnIdempotencyIdx: uniqueIndex('txn_idempotency_idx').on(t.tenantId, t.clientMutationId),
}));

export const transactionItems = pgTable('transaction_items', {
	id: serial('id').primaryKey(),
	tenantId: integer('tenant_id').notNull().references(() => tenants.id),
	transactionId: integer('transaction_id').notNull().references(() => transactions.id),
	categoryId: integer('category_id').notNull().references(() => categories.id),
	weightKg: numeric('weight_kg', { precision: 12, scale: 3 }),
	appliedPriceIdr: integer('applied_price_idr'), // OFFLINE PRICE LOCK: preserved verbatim from device, never recomputed from live price
	subtotalIdr: integer('subtotal_idr'),
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
}, (t) => ({
	tenantIdx: index('transaction_items_tenant_idx').on(t.tenantId),
	txnItemTransactionIdx: index('txn_item_transaction_idx').on(t.transactionId),
	txnItemCategoryIdx: index('txn_item_category_idx').on(t.categoryId),
}));

export const ledgers = pgTable('ledgers', {
	id: serial('id').primaryKey(),
	tenantId: integer('tenant_id').notNull().references(() => tenants.id),
	type: ledgerType('type').notNull(),
	amountIdr: integer('amount_idr').notNull(),
	balanceAfterIdr: integer('balance_after_idr').notNull(),
	referenceId: text('reference_id'),
	metadata: jsonb('metadata'),
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
}, (t) => ({
	tenantIdx: index('ledgers_tenant_idx').on(t.tenantId),
	ledgerTenantTimeIdx: index('ledger_tenant_time_idx').on(t.tenantId, t.createdAt),
})); // IMMUTABLE: inserts only, no update/delete helpers

export const productionLogs = pgTable('production_logs', {
	id: serial('id').primaryKey(),
	tenantId: integer('tenant_id').notNull().references(() => tenants.id),
	transactionId: integer('transaction_id').references(() => transactions.id),
	grossWeightKg: numeric('gross_weight_kg', { precision: 12, scale: 3 }),
	netWeightKg: numeric('net_weight_kg', { precision: 12, scale: 3 }),
	shrinkageKg: numeric('shrinkage_kg', { precision: 12, scale: 3 }), // COMPUTED app-side: always gross − net, never hand-entered
	categoryId: integer('category_id').references(() => categories.id),
	notes: text('notes'),
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
}, (t) => ({
	tenantIdx: index('production_logs_tenant_idx').on(t.tenantId),
	prodLogTransactionIdx: index('prod_log_transaction_idx').on(t.transactionId),
	prodLogCategoryIdx: index('prod_log_category_idx').on(t.categoryId),
	grossGteNetCheck: check('gross_gte_net', sql`${t.grossWeightKg} >= ${t.netWeightKg}`),
}));

export const factories = pgTable('factories', {
	id: serial('id').primaryKey(),
	tenantId: integer('tenant_id').notNull().references(() => tenants.id),
	name: text('name').notNull(),
	slug: text('slug').notNull(),
	address: text('address'),
	estimatedRouteCostIdr: integer('estimated_route_cost_idr'),
	isActive: boolean('is_active').default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`).notNull(),
}, (t) => ({
	tenantIdx: index('factories_tenant_idx').on(t.tenantId),
}));

export const factoryPriceQuotes = pgTable('factory_price_quotes', {
	id: serial('id').primaryKey(),
	tenantId: integer('tenant_id').notNull().references(() => tenants.id),
	factoryId: integer('factory_id').notNull().references(() => factories.id),
	categoryId: integer('category_id').notNull().references(() => categories.id),
	pricePerKg: integer('price_per_kg'),
	validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
	validTo: timestamp('valid_to', { withTimezone: true }).notNull(),
	isAccepted: boolean('is_accepted').default(false), // ONE-ACCEPTED RULE: max one accepted quote per (factory, category, overlapping period) — enforced in QuoteService (Fase 3)
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
}, (t) => ({
	tenantIdx: index('factory_price_quotes_tenant_idx').on(t.tenantId),
	fpqFactoryIdx: index('fpq_factory_idx').on(t.factoryId),
	fpqCategoryIdx: index('fpq_category_idx').on(t.categoryId),
}));

// --- Stock Lots (FIFO cost basis for HPP) ---
export const stockLots = pgTable('stock_lots', {
	id: serial('id').primaryKey(),
	tenantId: integer('tenant_id').notNull().references(() => tenants.id),
	categoryId: integer('category_id').notNull().references(() => categories.id),
	weightKg: numeric('weight_kg', { precision: 12, scale: 3 }).notNull(),
	hppPerKg: integer('hpp_per_kg').notNull(),
	consumedWeightKg: numeric('consumed_weight_kg', { precision: 12, scale: 3 }).default('0').notNull(), // FIFO depletion tracker
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
}, (t) => ({
	tenantIdx: index('stock_lots_tenant_idx').on(t.tenantId),
	lotCategoryIdx: index('lot_category_idx').on(t.tenantId, t.categoryId),
}));

// --- Payroll: attendance + runs + lines ---
export const attendances = pgTable('attendances', {
	id: serial('id').primaryKey(),
	tenantId: integer('tenant_id').notNull().references(() => tenants.id),
	userId: integer('user_id').notNull().references(() => users.id),
	date: date('date').notNull(),
	isPresent: boolean('is_present').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
}, (t) => ({
	tenantIdx: index('attendances_tenant_idx').on(t.tenantId),
	attendanceUniqueIdx: uniqueIndex('attendance_unique_idx').on(t.tenantId, t.userId, t.date),
}));

export const payrollRuns = pgTable('payroll_runs', {
	id: serial('id').primaryKey(),
	tenantId: integer('tenant_id').notNull().references(() => tenants.id),
	period: text('period').notNull(), // YYYY-MM
	umkIdr: integer('umk_idr').notNull(), // parameterized UMK for the period year
	status: text('status').default('DRAFT').notNull(), // DRAFT → SUBMITTED → APPROVED → PAID
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
}, (t) => ({
	tenantIdx: index('payroll_runs_tenant_idx').on(t.tenantId),
}));

export const payrollLines = pgTable('payroll_lines', {
	id: serial('id').primaryKey(),
	tenantId: integer('tenant_id').notNull().references(() => tenants.id),
	payrollRunId: integer('payroll_run_id').notNull().references(() => payrollRuns.id),
	userId: integer('user_id').notNull().references(() => users.id),
	baseSalaryIdr: integer('base_salary_idr').notNull(),
	pieceWeightKg: numeric('piece_weight_kg', { precision: 12, scale: 3 }),
	pieceRatePerKg: integer('piece_rate_per_kg'),
	totalIdr: integer('total_idr').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
}, (t) => ({
	tenantIdx: index('payroll_lines_tenant_idx').on(t.tenantId),
	lineRunIdx: index('line_run_idx').on(t.payrollRunId),
}));

// --- Relations ---
export const tenantsRelations = relations(tenants, ({ many }) => ({
	users: many(users),
	customers: many(customers),
	categories: many(categories),
	transactions: many(transactions),
	transactionItems: many(transactionItems),
	ledgers: many(ledgers),
	productionLogs: many(productionLogs),
	factories: many(factories),
	factoryPriceQuotes: many(factoryPriceQuotes),
}));

export const usersRelations = relations(users, ({ one }) => ({
	tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
}));

export const customersRelations = relations(customers, ({ one }) => ({
	tenant: one(tenants, { fields: [customers.tenantId], references: [tenants.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
	tenant: one(tenants, { fields: [categories.tenantId], references: [tenants.id] }),
	transactionItems: many(transactionItems),
	productionLogs: many(productionLogs),
	factoryPriceQuotes: many(factoryPriceQuotes),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
	tenant: one(tenants, { fields: [transactions.tenantId], references: [tenants.id] }),
	customer: one(customers, { fields: [transactions.customerId], references: [customers.id] }),
	factory: one(factories, { fields: [transactions.factoryId], references: [factories.id] }),
	acceptedQuote: one(factoryPriceQuotes, { fields: [transactions.acceptedQuoteId], references: [factoryPriceQuotes.id] }),
	transactionItems: many(transactionItems),
	productionLogs: many(productionLogs),
}));

export const transactionItemsRelations = relations(transactionItems, ({ one }) => ({
	tenant: one(tenants, { fields: [transactionItems.tenantId], references: [tenants.id] }),
	transaction: one(transactions, { fields: [transactionItems.transactionId], references: [transactions.id] }),
	category: one(categories, { fields: [transactionItems.categoryId], references: [categories.id] }),
}));

export const ledgersRelations = relations(ledgers, ({ one }) => ({
	tenant: one(tenants, { fields: [ledgers.tenantId], references: [tenants.id] }),
}));

export const productionLogsRelations = relations(productionLogs, ({ one }) => ({
	tenant: one(tenants, { fields: [productionLogs.tenantId], references: [tenants.id] }),
	transaction: one(transactions, { fields: [productionLogs.transactionId], references: [transactions.id] }),
	category: one(categories, { fields: [productionLogs.categoryId], references: [categories.id] }),
}));

export const factoriesRelations = relations(factories, ({ one, many }) => ({
	tenant: one(tenants, { fields: [factories.tenantId], references: [tenants.id] }),
	factoryPriceQuotes: many(factoryPriceQuotes),
}));

export const factoryPriceQuotesRelations = relations(factoryPriceQuotes, ({ one, many }) => ({
	tenant: one(tenants, { fields: [factoryPriceQuotes.tenantId], references: [tenants.id] }),
	factory: one(factories, { fields: [factoryPriceQuotes.factoryId], references: [factories.id] }),
	category: one(categories, { fields: [factoryPriceQuotes.categoryId], references: [categories.id] }),
	transactions: many(transactions),
}));

export const stockLotsRelations = relations(stockLots, ({ one }) => ({
	tenant: one(tenants, { fields: [stockLots.tenantId], references: [tenants.id] }),
	category: one(categories, { fields: [stockLots.categoryId], references: [categories.id] }),
}));

export const attendancesRelations = relations(attendances, ({ one }) => ({
	tenant: one(tenants, { fields: [attendances.tenantId], references: [tenants.id] }),
	user: one(users, { fields: [attendances.userId], references: [users.id] }),
}));

export const payrollRunsRelations = relations(payrollRuns, ({ one, many }) => ({
	tenant: one(tenants, { fields: [payrollRuns.tenantId], references: [tenants.id] }),
	lines: many(payrollLines),
}));

export const payrollLinesRelations = relations(payrollLines, ({ one }) => ({
	tenant: one(tenants, { fields: [payrollLines.tenantId], references: [tenants.id] }),
	run: one(payrollRuns, { fields: [payrollLines.payrollRunId], references: [payrollRuns.id] }),
	user: one(users, { fields: [payrollLines.userId], references: [users.id] }),
}));

// --- Exports ---
export const schema = {
	tenants,
	users,
	customers,
	categories,
	transactions,
	transactionItems,
	ledgers,
	productionLogs,
	factories,
	factoryPriceQuotes,
	stockLots,
	attendances,
	payrollRuns,
	payrollLines,
};



export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type NewTransactionItem = typeof transactionItems.$inferInsert;
export type Ledger = typeof ledgers.$inferSelect;
export type NewLedger = typeof ledgers.$inferInsert;
export type ProductionLog = typeof productionLogs.$inferSelect;
export type NewProductionLog = typeof productionLogs.$inferInsert;
export type Factory = typeof factories.$inferSelect;
export type NewFactory = typeof factories.$inferInsert;
export type FactoryPriceQuote = typeof factoryPriceQuotes.$inferSelect;
export type NewFactoryPriceQuote = typeof factoryPriceQuotes.$inferInsert;
export type StockLot = typeof stockLots.$inferSelect;
export type NewStockLot = typeof stockLots.$inferInsert;
export type Attendance = typeof attendances.$inferSelect;
export type NewAttendance = typeof attendances.$inferInsert;
export type PayrollRun = typeof payrollRuns.$inferSelect;
export type NewPayrollRun = typeof payrollRuns.$inferInsert;
export type PayrollLine = typeof payrollLines.$inferSelect;
export type NewPayrollLine = typeof payrollLines.$inferInsert;
export type TenantType = 'HUB' | 'SPOKE';
export type UserRole = 'OWNER' | 'PARTNER' | 'DRIVER' | 'WORKER' | 'TENANT_ADMIN' | 'ACCOUNTANT';
export type TransactionType = 'INBOUND' | 'OUTBOUND';
export type TransactionStatus = 'DRAFT' | 'SYNCED' | 'VERIFIED' | 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED';
export type LedgerType = 'CASH_IN' | 'CASH_OUT' | 'DEBT_ADD' | 'DEBT_PAY';
