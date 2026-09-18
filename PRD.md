# Circular Economy ERP & Aggregator Platform — Product Requirements Document

> **Revisi maksimal v2 (FINAL — dikonfirmasi user 2026-09-17)** — menutup gap P0/P1/P2 hasil audit PRD vs `packages/db/src/schema.ts`.
> Riwayat asumsi tercatat di Decision Log (§11); semua telah dikonfirmasi dan berlaku sebagai keputusan produk.

## 1. Executive Summary

**Vision:** A B2B2C platform connecting waste aggregators (Hub), neighborhood banks (Spokes), and recycling factories to create a transparent, efficient circular economy ecosystem in Semarang and beyond.

**Target Users:**
- **Hub Owners** — Operate the aggregator/warehouse, buy raw waste from Spokes, sort in bulk, sell to factories.
- **Spoke Operators (Tenant/Bank Sampah)** — Manage neighborhood collection points, track individual customer savings (tabungan sampah eceran).
- **Drivers & Workers** — Field operations staff collecting and sorting waste via PWA mobile app.
- **Accountants** — Record operational costs, view finance; cannot approve payouts.
- **Partner Investors** — Investors with 50/50 profit-sharing rights, read-only access to Hub financial metrics.

**Business Model:** Hub-and-Spoke with 50/50 profit sharing between Owner and Partner (losses shared 50/50 too, with carry-forward — see §6.5). The Hub aggregates waste from multiple Spokes, sorts it into categorized bulk lots, and sells to registered factories. All IDR amounts are stored as integers (whole rupiah, no decimal subdivisions).

---

## 2. Business Model

### 2.1 Roles

| Role | Description | Access Level |
|------|-------------|-------------|
| **OWNER** | Hub owner (or Spoke owner within own tenant). Full operational + financial control in scope. | Full access within tenant scope |
| **TENANT_ADMIN** | Spoke administrator. | Full access within own Spoke tenant |
| **ACCOUNTANT** | Records operational costs, views finance. | Read finance + input costs; NO payout approval, NO ledger delete (immutable for all) |
| **PARTNER** | Investor with 50/50 profit share. | Read-only: Ledger, Shrinkage, Net Profit (endpoint list §5.3) |
| **DRIVER / WORKER** | Field operations via PWA. | Create DRAFT transactions, capture photos; cannot verify/complete |

### 2.2 Revenue Flow

1. **Spoke sells raw waste to Hub** — Transaction recorded as INBOUND, price locked at capture time (OFFLINE PRICE LOCK, §6.1).
2. **Hub sorts waste** — Production logs track gross weight, net weight, shrinkage; sorted output becomes **Stock Lots** (§3.4).
3. **Hub sells to Factory** — OUTBOUND transaction linked to factory + accepted quote (§6.3); factory bidding determines best price.
4. **Profit Calculation:**
   - `Net Profit = Factory Revenue − HPP (FIFO from Stock Lots) − Operational (worker wages + owner management salary + recorded costs)`
   - `Owner Share = Net Profit × 0.5`
   - `Partner Share = Net Profit − Owner Share`
   - Net loss: shared 50/50, carried forward as opening deduction next period (§6.5).
5. **Supplier Debt (Kasbon):** `customers.debtIdr` = **utang warga (customer) ke Spoke**. On INBOUND, system auto-deducts: `netTotal = totalIdr − Math.min(outstandingDebt, totalIdr)` and MUST emit a `DEBT_PAY` ledger entry for the deducted amount (§6.2).

---

## 3. Core Modules

### 3.1 Module 1: Field Operations (PWA Offline)

**Target Users:** Drivers, Workers

**Requirements:**

- **PWA with offline-first architecture** — IndexedDB for local storage + Background Sync API for deferred synchronization.
- **Large Numpad UI** — Fast data entry for weight and quantity input on mobile devices.
- **Photo capture with Canvas/JS compression** — Images compressed to < 200KB before upload. Required for transactions ≥ Rp500.000; retained 1 year on object storage; queued in IndexedDB when offline (§6.9).
- **OFFLINE PRICE LOCK** — Transactions use the cached price at capture. Device stores `appliedPriceIdr` and `offlineTimestamp` verbatim. Server preserves them exactly — never recomputes from live price. `serverTimestamp` is authoritative for ordering; device clock validated per §6.8.
- **Idempotency:** every offline-created transaction carries `clientMutationId` (UUID v4 from device). Unique per `(tenantId, clientMutationId)`. Duplicate sync returns `200` + existing record — never a second row (§6.10).
- **Status flow:** `DRAFT` (created, offline or online) → `SYNCED` (received by server) → `VERIFIED` (checked by OWNER/TENANT_ADMIN) → `COMPLETED` (paid/settled). Side states: `PENDING` (legacy/intermediate, awaiting action), `FAILED` (validation/sync failure), `CANCELLED` (voided by OWNER, reason required). Default status for new rows: `DRAFT`.
- **Transaction structure:** customer ref, type (INBOUND/OUTBOUND), status, `clientMutationId`, offline + server timestamps, total IDR, proof photo URL. OUTBOUND additionally carries `factoryId` + `acceptedQuoteId`. Items reference categories with `appliedPriceIdr` and `weightKg`.

### 3.2 Module 2: Finance, Kasbon & Payroll

**Target Users:** Hub Owners, Spoke Operators, Accountants

**Requirements:**

- **Supplier Debt (Kasbon):** direction fixed — customer owes the Spoke. Deduction applies ONLY to INBOUND. Every deduction emits `DEBT_PAY` ledger entry (`amountIdr` = deducted amount, `referenceId` = transaction id). Debt increases emit `DEBT_ADD`.
- **Payroll Hybrid (UMK parameterized per year; default UMK Semarang 2026 = Rp3,701,709):**
  - Base salary = 60% of applicable UMK, pro-rated by attendance (`attendances`: one row per user per date).
  - Piece-rate incentive = `pieceWeightKg × pieceRatePerKg` (borongan; rate source: per-category config set by OWNER).
  - Payroll computed per `payroll_runs` period (`YYYY-MM`) into `payroll_lines`; payslip = base + piece-rate.
- **50/50 Profit Split:** per §2.2 step 4 + §6.5. All values non-negative integers except Net Profit which may be negative (loss path).
- **Ledger (Immutable):** inserts-only (`CASH_IN`, `CASH_OUT`, `DEBT_ADD`, `DEBT_PAY`). No update/delete. Each entry: type, amount, `balanceAfterIdr`, reference ID, metadata. `balanceAfterIdr` MUST be computed inside a DB transaction with row-locking (serializable) — never read-then-write (§6.7).

### 3.3 Module 3: Outbound Bidding Engine & Shrinkage

**Target Users:** Hub Owners, Factory Partners

**Requirements:**

- **Shrinkage Tracking:** `shrinkageKg = grossWeightKg − netWeightKg`, always computed app-side (never hand-entered); DB enforces `gross ≥ net` via CHECK. Percentage = `(shrinkageKg / grossWeightKg) × 100`. Threshold ≤ 10%; breach triggers in-app warning to OWNER + audit log entry.
- **Factory Bidding:** `Net Margin = (saleableTonStock × pricePerKg) − estimatedRouteCostIdr`, where stock comes from **Stock Lots** (§3.4). Ranked descending; rank #1 = highest margin.
- **Quote Management:** quotes require `validFrom`/`validTo`. Exactly ONE accepted quote per (factory, category, overlapping period) — enforced app-side + documented; expired quotes transition to `EXPIRED` and can never attach to new OUTBOUND. Accept/reject restricted to OWNER.

### 3.4 Module 4: Stock Lots & HPP (FIFO)

**Target Users:** Hub Owners, Accountants

**Requirements:**

- Sorting output creates **stock lots**: `(categoryId, weightKg, hppPerKg)` where HPP per kg = inbound cost basis of the sorted batch.
- **Cost method fixed: FIFO**. Consumption for OUTBOUND depletes oldest lots first (`consumedWeightKg` tracked per lot).
- `tonStock` used by bidding = sum of remaining (`weightKg − consumedWeightKg`) across lots per category.
- HPP of an OUTBOUND = sum of depleted lot costs. This HPP feeds Net Profit.

---

## 4. Technical Architecture

### 4.1 Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.4.x (`Bun.serve`) |
| Framework | SvelteKit 5 (Svelte 5 Runes: `$state`, `$derived`, `$effect`) |
| Database | PostgreSQL 8.11 via Drizzle ORM 0.34.x |
| Styling | TailwindCSS 4 (mobile-first) |
| Offline | PWA with IndexedDB + Background Sync API |
| Storage | Object Storage (S3/Cloudflare R2) — PostgreSQL stores URL strings only |
| Auth | Two layers: `x-api-key` (M2M) + JWT/session + refresh (human users), argon2/bcrypt hashing |
| Linting/Typecheck | Biome + tsc --noEmit |

### 4.2 Monorepo Structure

```
recycle-app/
├── packages/db/          # Drizzle schema + TypeScript types (14 tables, 5 enums)
├── packages/server/      # Service layer, repositories, error handling, DI, middleware
├── packages/shared/      # Shared types and utilities
└── apps/web/             # SvelteKit 5 frontend (PWA support)
```

### 4.3 Multi-Tenant Architecture

- **ALL tables have `tenantId` FK to `tenants`** with a database index.
- **Every query filters by `tenantId`** — row-level isolation ensures data separation.
- **Tenant types:** `HUB` and `SPOKE`.
- **Hub data** (factories, factory_price_quotes, stock_lots) lives under the Hub tenantId.
- **Spoke visibility:** Spokes see the Hub's published buying price list (read-only feed) but never other Spokes' transactions.
- **Partner read-only** enforced at API layer per endpoint matrix (§5.3), covered by tests.

### 4.4 Database Schema Summary

**14 Tables:**

| Table | Key Columns | Tenant Index |
|-------|-------------|-------------|
| `tenants` | id, name, type, slug | — |
| `users` | id, tenantId, email, passwordHash, role | tenant_idx, user_tenant_role_idx |
| `customers` | id, tenantId, name, phone, balanceIdr, debtIdr (utang warga→Spoke) | tenant_idx |
| `categories` | id, tenantId, name, pricePerKg, unit, isActive | tenant_idx |
| `transactions` | id, tenantId, customerId, type, status (default DRAFT), clientMutationId UUID, factoryId?, acceptedQuoteId?, offlineTimestamp, serverTimestamp, totalIdr, proofPhotoUrl | tenant_idx, txn_tenant_time_idx, unique(tenantId, clientMutationId) |
| `transaction_items` | id, tenantId, transactionId, categoryId, weightKg, appliedPriceIdr, subtotalIdr | tenant_idx, txn_item_transaction_idx, txn_item_category_idx |
| `ledgers` | id, tenantId, type, amountIdr, balanceAfterIdr (DB-txn computed), referenceId, metadata | tenant_idx, ledger_tenant_time_idx |
| `production_logs` | id, tenantId, transactionId, grossWeightKg, netWeightKg, shrinkageKg (computed), categoryId, notes; CHECK(gross ≥ net) | tenant_idx, prod_log_transaction_idx, prod_log_category_idx |
| `factories` | id, tenantId, name, slug, address, estimatedRouteCostIdr, isActive | tenant_idx |
| `factory_price_quotes` | id, tenantId, factoryId, categoryId, pricePerKg, validFrom!, validTo!, isAccepted (one-accepted rule) | tenant_idx, fpq_factory_idx, fpq_category_idx |
| `stock_lots` | id, tenantId, categoryId, weightKg, hppPerKg, consumedWeightKg (FIFO) | tenant_idx, lot_category_idx |
| `attendances` | id, tenantId, userId, date, isPresent | tenant_idx, unique(tenantId, userId, date) |
| `payroll_runs` | id, tenantId, period YYYY-MM, umkIdr, status | tenant_idx |
| `payroll_lines` | id, tenantId, payrollRunId, userId, baseSalaryIdr, pieceWeightKg, pieceRatePerKg, totalIdr | tenant_idx, line_run_idx |

**5 Enums:**

| Enum | Values |
|------|--------|
| `tenant_type` | `HUB`, `SPOKE` |
| `user_role` | `OWNER`, `PARTNER`, `DRIVER`, `WORKER`, `TENANT_ADMIN`, `ACCOUNTANT` |
| `transaction_type` | `INBOUND`, `OUTBOUND` |
| `transaction_status` | `DRAFT`, `SYNCED`, `VERIFIED`, `COMPLETED`, `PENDING` (legacy), `FAILED`, `CANCELLED` |
| `ledger_type` | `CASH_IN`, `CASH_OUT`, `DEBT_ADD`, `DEBT_PAY` |

**Data Types:**
- All IDR amounts: `integer` (no decimal subdivisions)
- All weights: `numeric(12,3)`
- All timestamps: `timestamptz` with `default(sql\`now()\`)`; display timezone Asia/Jakarta
- Ledger entries: immutable (inserts only)

---

## 5. API Design (Fase 3)

- **Runtime:** `Bun.serve` routes under `/api/v1`. Health check: `GET /up` → `{ status: 'ok' }`.
- **Authentication (two layers):**
  - M2M/integration: `x-api-key` header.
  - Human users (PWA): login → short-lived JWT + refresh token; passwords hashed argon2/bcrypt exclusively.
  - Every protected route enforces BOTH identity AND role (§5.3).
- **Pattern:** per-resource routes. Reads: `GET /` (paginated) + `GET /:idOrSlug`.
- **Error envelope (standard):** `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {...} } }` with matching HTTP status.
- **Pagination:** `?limit=` (default 20, max 100) + `?cursor=`; response `{ data, nextCursor }`.
- **Rate limiting:** auth endpoints 5/min/IP; public reads 100/min/key; sync ingest 60/min/device.
- **No Passport/OAuth** unless user-scoped OAuth is explicitly required.

### 5.3 Role × Endpoint Matrix (enforced + tested)

| Endpoint group | OWNER | TENANT_ADMIN | ACCOUNTANT | PARTNER | DRIVER/WORKER |
|---|---|---|---|---|---|
| transactions create (DRAFT) | ✅ | ✅ own tenant | ❌ | ❌ | ✅ |
| transactions verify/complete/cancel | ✅ | ✅ own tenant | ❌ | ❌ | ❌ |
| transactions read | ✅ | ✅ own tenant | ✅ | ❌ (ledger view only) | ✅ own |
| ledgers read | ✅ | ✅ | ✅ | ✅ read-only | ❌ |
| ledgers write (via services) | ✅ | ✅ | ❌ direct | ❌ | ❌ |
| operational costs input | ✅ | ✅ | ✅ | ❌ | ❌ |
| factories/quotes manage | ✅ (Hub) | ❌ | ❌ | ❌ | ❌ |
| payroll runs approve | ✅ | ❌ | ❌ (prepare only) | ❌ | ❌ |
| profit-split reports | ✅ | ❌ | ✅ read | ✅ read-only | ❌ |

---

## 6. Business Rules & Edge Cases

1. **Offline Price Lock:** preserve `appliedPriceIdr` + `offlineTimestamp` verbatim — never recompute on sync.
2. **Kasbon:** INBOUND only. `netTotal = totalIdr − Math.min(outstandingDebt, totalIdr)` + mandatory `DEBT_PAY` entry for deducted amount. Direction: customer owes Spoke.
3. **Payroll:** `baseSalary = UMK(year) × 0.6 × (presentDays / workingDays)`; `piece = pieceWeightKg × pieceRatePerKg`; payslip total = base + piece. UMK default 2026 = 3,701,709 (parameterized per year).
4. **Profit Split:** 50:50 after ALL operational costs incl. wages. `Owner = Net × 0.5`, `Partner = Net − Owner`.
5. **Loss path:** net loss shared 50/50 and carried forward as opening deduction of next period's Net Profit before split.
6. **Shrinkage:** computed `gross − net` (CHECK enforced); > 10% → in-app warning to OWNER + audit log.
7. **Factory Ranking:** rank #1 = highest `Net Margin = (saleableTonStock × pricePerKg) − estimatedRouteCostIdr`.
8. **Clock policy:** `serverTimestamp` authoritative. Reject `offlineTimestamp` > 24h in future or > 30 days old unless OWNER overrides with reason. Display Asia/Jakarta.
9. **Ledger Immutability:** inserts only; `balanceAfterIdr` computed inside DB transaction with row lock.
10. **Idempotency:** `(tenantId, clientMutationId)` unique; duplicates → 200 + existing record.
11. **Tenant Isolation:** every query filters by `tenantId`. No cross-tenant access.
12. **All IDR integers** — no cents.
13. **Photo policy:** required ≥ Rp500.000; < 200KB via Canvas/JS; 1-year R2 retention; IndexedDB queue offline.
14. **Quote validity:** `validFrom/To` required; one accepted per (factory, category, overlap); expired quotes never attach to new OUTBOUND.
15. **OUTBOUND linkage:** must reference an accepted, unexpired quote + factory; else rejected with validation error.

---

## 7. Acceptance Criteria

**Fase 1–2 (done):**
- [x] 10 tables with `tenantId` FK + index; 5 enums; relations; 18 indexes
- [x] OFFLINE PRICE LOCK preserved verbatim; LEDGER immutable
- [x] FinanceService (debt, payroll, split); BiddingService (shrinkage, ranking, quotes)
- [x] PWA offline price lock + image compression; AppError hierarchy; DI Container; typecheck PASS

**Fase 3 (pending):**
- [ ] New tables: `stock_lots`, `attendances`, `payroll_runs`, `payroll_lines`; new columns/constraints per §4.4
- [ ] Offline→online sync success ≥ 99% in field test (incl. duplicate-retry → single row)
- [ ] PWA installable, fully usable offline for DRAFT creation + photo queue
- [ ] Role×endpoint matrix enforced, incl. PARTNER read-only (negative tests)
- [ ] Kasbon E2E: debt → INBOUND deduction → DEBT_PAY journal → balances reconcile
- [ ] Profit-split E2E incl. loss carry-forward scenario
- [ ] 80%+ line coverage (unit + integration); typecheck + lint PASS

---

## 8. Fase 3 Roadmap (Pending Approval)

- **Server Setup:** `Bun.serve` + `x-api-key` middleware + JWT session + throttle
- **REST API Routes:** CRUD per resource (14 resources) with envelope + pagination
- **Services:** StockLotService (FIFO), PayrollService, IdempotentSyncService, QuoteService (one-accepted guard)
- **SvelteKit 5 Frontend:** full PWA offline-first (IndexedDB queue, Background Sync, install prompt)
- **Drizzle Migrations:** `drizzle-kit generate/migrate` for new tables/columns
- **Test Suites:** 80%+ coverage incl. E2E scenarios above

---

## 9. Constraints

### 9.1 Product Constraints
- All IDR amounts are integers (no cents)
- PostgreSQL only for production (no SQLite)
- Object Storage (S3/R2) for files — PostgreSQL stores URLs only
- Display timezone Asia/Jakarta; storage timestamptz UTC
- NEVER add Passport/OAuth unless user-scoped OAuth is required — start with `x-api-key` + JWT

### 9.2 Working Agreements (agent workflow, not product)
- NEVER read sibling `.env` contents — `.env.example` shape only
- NEVER enter `vendor/`, `node_modules/`, `storage/`, `.git/` when mapping
- NEVER create source code speculatively — scaffolding belongs to a task
- Never enter sibling repo directories — read-only references only

---

## 10. Appendices

### A. Tenant Roles Matrix (corrected)

| Role | Scope | Capabilities |
|------|-------|-------------|
| **OWNER** | Own tenant (Hub or Spoke) | Full access: operations, finance, verify/complete/cancel, approve payroll, manage quotes (Hub) |
| **TENANT_ADMIN** | Own Spoke tenant | Full access within Spoke; cannot touch Hub data or other Spokes |
| **ACCOUNTANT** | Assigned tenant | Read finance + input operational costs + prepare payroll; cannot approve payouts or manage quotes |
| **PARTNER** | Hub tenant | Read-only: ledgers, shrinkage reports, profit-split reports |
| **DRIVER / WORKER** | Assigned tenant | Create DRAFT transactions + photos; read own history |

### B. Status Flows

**Transaction Lifecycle:**
```
DRAFT → SYNCED → VERIFIED → COMPLETED
  │        │          │
  │        └→ FAILED ─┘
  └→ CANCELLED (OWNER + reason)
(PENDING = legacy intermediate, treated as awaiting action)
```

**Factory Quote Lifecycle:**
```
DRAFT → ACTIVE → ACCEPTED ─→ EXPIRED
              └→ REJECTED ─→ (terminal)
```

**Payroll Lifecycle:**
```
DRAFT → SUBMITTED → APPROVED → PAID
```

### C. Key Constants

| Constant | Value |
|----------|-------|
| UMK Semarang (default 2026, parameterized/year) | Rp3,701,709 |
| Base salary ratio | 60% (pro-rated by attendance) |
| Profit/loss split ratio | 50% (loss carried forward) |
| Shrinkage acceptable threshold | 10% |
| Photo required threshold | ≥ Rp500.000 |
| Image compression target | < 200KB |
| Offline clock window | reject >24h future / >30d past w/o override |
| Cost method | FIFO |
| Payable amount storage | Integer (whole IDR) |
| Weight precision | numeric(12,3) |
| Timestamp type | timestamptz (display Asia/Jakarta) |

---

## 11. Decision Log (v2 revision)

| # | Decision | Reason | Status |
|---|----------|--------|--------|
| 1 | Status lifecycle DRAFT→SYNCED→VERIFIED→COMPLETED + FAILED/CANCELLED; default DRAFT | PENDING as terminal was incoherent; schema default contradicted PRD | Accepted |
| 2 | `clientMutationId` UUID unique per tenant | Background Sync retries would duplicate financial rows | Accepted |
| 3 | OUTBOUND requires factoryId + acceptedQuoteId | Bidding output otherwise unlinked to sales | Accepted |
| 4 | Two-layer auth (x-api-key + JWT), argon2/bcrypt, role×endpoint matrix | x-api-key alone cannot serve PWA users or enforce PARTNER read-only | Accepted |
| 5 | Kasbon direction: customer owes Spoke; mandatory DEBT_PAY journal | Formula without journal breaks cash reconciliation | Accepted |
| 6 | Stock Lots + FIFO HPP | tonStock/HPP had no source table; profit uncomputable | Accepted — dikonfirmasi user 2026-09-17 |
| 7 | Payroll entities + parameterized UMK | No attendance/rate source; hardcoded UMK rots yearly | Accepted |
| 8 | Loss 50/50 + carry-forward tanpa batas waktu; dievaluasi tiap tutup tahun | PRD claimed non-negative but losses are real | Accepted — dikonfirmasi user 2026-09-17 |
| 9 | Photo ≥Rp500rb, 1-yr retention, offline queue | Unbounded R2 growth + disputes without proof | Accepted — dikonfirmasi user 2026-09-17 |
| 10 | Clock window 24h/30d | Device clocks untrusted | Accepted — dikonfirmasi user 2026-09-17 |
| 11 | ACCOUNTANT role added | Accountants were users with no role | Accepted |
