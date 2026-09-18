# PROJECT KNOWLEDGE BASE — recycle-app

**Generated:** 2026-09-16
**Commit:** none (zero commits, repo initialized, `master` has no revision yet)
**Branch:** master
**Assumption (explicit):** `RECYCLE-APP GREENFIELD` — repo contains no
application code. Verified 2026-09-16: root holds only `.codegraph` (symlink),
`.omo/`, `.opencode/`. No `composer.json`, `package.json`, `app/`, `routes/`,
`database/`, `tests/`. Everything below about stack/structure is a hypothesis
to refine, not a description of existing code.

## OVERVIEW

Recycle-app is a greenfield project. Default hypothesis (H1, reversible):
Laravel 13.8 + Filament 5 + Vite 8 + Tailwind 4, mirroring all three sibling
repos. Admin panel via Filament resources; public API versioned `v1` behind
`x-api-key` + `throttle`. Final stack decided in architecture design (Langkah 2),
not here — this file is stack-agnostic and must be refined once scaffolding lands.

**STACK UPDATE (2026-09-16):** H1 REJECTED by user directive. Current stack: Bun 1.4.x + SvelteKit 5 + Drizzle ORM 0.34.x + PostgreSQL 8.11. Monorepo with `apps/web` (SvelteKit) and `packages/db` (Drizzle schema). See STACK HYPOTHESIS + RE-DETECTION above.

## STRUCTURE (actual today + anticipated)

Actual (verified `ls -la` 2026-09-16):

```
recycle-app/
├── .codegraph/   # symlink → codegraph index, not source
├── .omo/         # run-continuation + notepads (recycle-app-init)
├── .opencode/    # agent config (flowdeck.log, package.json) — DO NOT edit lsp.json
├── AGENTS.md     # this file
├── apps/         # SvelteKit web app
├── packages/     # db (Drizzle schema), shared
├── bunfig.toml
├── bun.lock
└── package.json  # Bun workspace root
```

Anticipated once H1 scaffolding lands (do NOT create speculatively):

```
recycle-app/
├── apps/web/              # SvelteKit app
├── packages/db/src/schema.ts  # Drizzle ORM PostgreSQL schema (10 tables, 5 enums)
├── packages/shared/       # shared types/utils
├── Dockerfile.prod / compose.yaml (only when deploy needed)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Stack rationale + sibling evidence | `~/.fd-plan/recycle-app/.codebase/ARCHITECTURE.md` §2–§4 | Read-only, owned by mapping agent — reuse, do not edit |
| Naming/routing/auth/test conventions | `~/.fd-plan/recycle-app/.codebase/CONVENTIONS.md` | Same ownership rule as above |
| Session wisdom (mapping + this task) | `.omo/notepads/recycle-app-init/learnings.md`, `decisions.md` | Append-only via `>>`, never overwrite |
| Agent run log | `.opencode/flowdeck.log` | Read-only context |
| Filament bootstrap pattern | Sibling `app/Providers/Filament/AdminPanelProvider.php` | Read-only reference, copy shape only |
| API guard pattern | Sibling `routes/api.php` (`v1` + `x-api-key`, `throttle:5,1`) | Cheapest M2M auth; Passport only if user OAuth needed |
| Test harness pattern | Sibling `phpunit.xml` (`sqlite :memory:`) + `tests/Feature` | No external DB for CI |
| Sibling `.env` contents | NOWHERE — forbidden | Note only `.env.example` existence, never read values |

## CODE MAP

No application symbols exist yet (greenfield, zero commits). Centrality
unmeasured — there is nothing to index beyond infra dotfiles. When code lands,
record entry points here:

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| (belum ada) | — | — | — | First scaffolded route/model/resource goes here |
| `schema.ts` | schema | `packages/db/src/schema.ts` | — | Drizzle ORM PostgreSQL schema (10 tables, 5 enums) |
| `AdminPanelProvider` | provider (anticipated) | `app/Providers/Filament/AdminPanelProvider.php` | — | Filament panel bootstrap (copy sibling shape) |
| `HealthCheckController` | controller (anticipated) | `routes/web.php` → `GET /up` | — | Keep from day one |

## STACK HYPOTHESIS + RE-DETECTION

- H1 (rejected by user directive 2026-09-16): Laravel `^13.8` + Filament `~5.0` + PHP `^8.3`, Vite `^8.0` + Tailwind `^4`, PHPUnit `^12` (Pest `^4.7` optional), sqlite `:memory:` for tests. **REJECTED** — user directive replaced stack.
- H1-REPLACEMENT (user directive 2026-09-16): Bun `1.4.x` + SvelteKit `5` + Drizzle ORM `^0.34.x` + PostgreSQL `^8.11`. Monorepo with `apps/web` (SvelteKit) and `packages/db` (Drizzle schema). Source: user directive.
- Re-detection rule: the moment `bun.lock` / `package.json` / `drizzle.config.ts` appears, whoever scaffolds MUST update OVERVIEW + STRUCTURE + COMMANDS in this file with pinned versions read from those manifests (never guesses), and record the H1-confirm-or-reject decision in `.omo/notepads/recycle-app-init/decisions.md`.

## COMMANDS (hypothesis — activate only after scaffold)

```bash
bun run dev          # SvelteKit dev
bun run build        # SvelteKit build
bun run db:generate  # drizzle-kit generate
bun run db:migrate   # drizzle-kit migrate
bun run db:push      # drizzle-kit push
bun run typecheck    # tsc --noEmit
```

Until manifests exist: none of the above runs. Do NOT `bun install` speculatively. Generic lint/test/build commands from the template do not apply to an empty repo — the blocks above replace them.

## CONVENTIONS

- Bun/SvelteKit: `apps/web` is a SvelteKit app using Bun runtime; `packages/db` uses TypeScript with Drizzle ORM.
- Drizzle: `pgTable`, `serial`/`integer`/`text`/`timestamp`/`numeric`/`pgEnum` from `drizzle-orm/pg-core`; `relations` from `drizzle-orm`; `index().on()` for indexes; `timestamp('col', { withTimezone: true }).default(sql\`now\()`)` for timestamps; `numeric(12,3)` for weights.
- IDR amounts: stored as integer (whole rupiah, no decimal subdivisions).
- API: `Route::prefix('v1')->middleware('x-api-key')->group(...)` (Laravel, anticipated); reads are `index` + `show` with `{idOrSlug}`; throttle public/ingest (`throttle:5,1` contact, `throttle:60,1` telemetry).
- Tests: TBD (framework TBD post-Langkah 2).
- Naming: variables/functions camelCase, types/classes PascalCase, constants UPPER_SNAKE_CASE, files kebab-case (org-wide, from CONVENTIONS.md §1–§2).
- Branching: `main` prod-tracking; feature branches `<type>/<short-topic>`
  (`feat/webp`, `fix/direct-index`, `upgrade/filament-v5` observed).
- Commits: conventional `type(scope): description`
  (`feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `ci`, `build`);
  squash-merge; atomic, no WIP on shared branches.

## ANTI-PATTERNS (THIS PROJECT)

- NEVER read sibling `.env` contents; NEVER copy secrets. `.env.example` shape only.
- NEVER enter `vendor/`, `node_modules/`, `storage/`, `.git/` when mapping.
- NEVER invent a sibling pattern without a file path (`file:line` required).
- NEVER add Passport/OAuth unless user-scoped OAuth is required — start `x-api-key`.
- NEVER create source code speculatively — scaffolding belongs to a later task.
- NEVER touch sibling dirs (`deepsky-villa-be`, `filament-basic`,
  `monitoring-cctv`) — read-only references. See AGENT BOUNDARIES.
- NEVER edit `~/.fd-plan/recycle-app/.codebase/*` (mapping agent owns it) or
  `.opencode/lsp.json` (parallel agent owns it).

## AGENT BOUNDARIES

- Writable: `/home/gyxpram/project/recycle-app/` only — `AGENTS.md` + notepad
  appends under `.omo/notepads/recycle-app-init/`.
- Read-only: sibling repos, `~/.fd-plan/recycle-app/.codebase/*`,
  `.opencode/lsp.json`, any `.env` with values.
- Forbidden: global installs, `composer/npm install`, credentials in any output,
  source-code scaffolding in this task.

## WHEN TO SPLIT SUB-AGENTS.md

Root-only is correct today (no code, all scores <8). Any agent that creates a
new top-level domain directory MUST evaluate a split at creation time:

| New directory | Split trigger | Content of child file |
|---------------|---------------|-----------------------|
| `app/Filament/` | >10 `*Resource.php` or custom Pages/Widgets appear | Resource-per-model list, panel provider notes |
| `app/Http/Controllers/Api/` | >1 per-domain subdir or >10 controllers | Per-domain routing map, `index/show` status |
| `database/` | custom factories/seeders beyond default | Migration ordering, seeder dependencies |
| `tests/` | suites diverge (e.g. Pest + PHPUnit mixed) | Runner choice, coverage gate (≥80%) |
| `deploy/` / `docker/` | prod deploy files land | Deploy flow, CI tarball-rsync notes |

Child files: 30–80 lines, NEVER repeat parent content (link back instead).

## HOW TO UPDATE THIS FILE

1. If `AGENTS.md` exists at target path → `Edit`; else → `Write`. Never
   blind-overwrite: read first, then merge/extend.
2. Triggers: new manifest (re-pin versions), new top-level dir (evaluate split
   per table above), new auth/deploy pattern, any Kreuzung where sibling
   evidence contradicts this file (cite `file:line`, fix here + notepad).
3. Every update appends one `## [TIMESTAMP] Task: <name>` entry to
   `.omo/notepads/recycle-app-init/learnings.md` (append-only `>>`).
4. Keep telegraphic, 50–150 lines for root; drop anything true of ALL projects.
5. Verify after edit: `ls -la AGENTS.md && wc -l AGENTS.md && head -50 AGENTS.md`.

## NOTES / GOTCHAS

- Previous init-deep attempt failed on infra (`google/gemini-3.6-flash` not
  found), not content — scope unchanged, this retry completes it.
- `git log` says `master has no commits yet` — that is normal, not an error.
- `.codegraph` is a symlink, not a directory — do not write into it.
- Style reference: sibling `deepsky-villa-be/AGENTS.md` (laravel-boost,
  423 lines) is the org's mature shape; this file grows toward it as code lands.
- No credentials exist in this repo; keep it that way.
