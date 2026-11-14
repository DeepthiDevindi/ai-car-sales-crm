# Day 3 report: tenant-safe database foundation

## Completed

- Preserved the two previously applied migration records and restored the missing local SQL for `20261114044807_day3_database_foundation` from the saved repository snapshot. That historical migration was not modified or rerun.
- Extended the Prisma schema while retaining the legacy physical table names, including mapping logical `DealershipMembership` to `UserDealership`.
- Added and applied `20261114110000_day3_tenant_safe_crm`. The migration added dealership-scoped relationships, membership roles, role-scope checks, indexes, and guarded legacy backfills. It contains no table or column drops.
- Added the shared Prisma module/service and changed the database health check to execute a real `SELECT 1`; the overall health endpoint continues to require both PostgreSQL and Redis.
- Used explicit Nest injection tokens for constructor dependencies so the `tsx` development runtime wires the health and persistence services correctly.
- Added an internal tenant-scoped repository for CRM persistence operations and PostgreSQL integration tests for tenant-scoped reads, cross-tenant references, and membership authorization.
- Added database schema, relationship, and tenant-isolation documentation and updated the requirement matrix using only the existing R1-R5 identifiers.

## Migration and database evidence

- Before applying the follow-up migration, read-only checks showed zero rows in `Lead`, `LeadAssignment`, `LeadActivity`, `ExternalVehicleReference`, `UserRole`, `Role`, and `UserDealership`; all migration guard counts were zero.
- `prisma migrate deploy` applied the follow-up migration successfully. `prisma migrate status` reports the database schema is up to date.
- The PostgreSQL integration suite ran against the local database: 6 tests passed. Its randomized synthetic fixtures were cleaned up.
- The repository did not contain the referenced SRS/SAD documents. Product behavior beyond the available R1-R5 matrix is not claimed or inferred.

## Validation

- `pnpm --dir apps/api prisma validate` — passed.
- `pnpm --dir apps/api prisma generate` — passed.
- `pnpm --dir apps/api typecheck` — passed.
- `pnpm --dir apps/api lint` — passed.
- `pnpm --dir apps/api test` — 4 unit tests passed; the opt-in PostgreSQL suite was skipped in this default run.
- PowerShell `$env:RUN_DB_INTEGRATION_TESTS = '1'; pnpm --dir apps/api test:integration` — 6 PostgreSQL integration tests passed.
- `pnpm --dir apps/api prisma migrate status` — passed; schema up to date.
- Root `pnpm test` — passed; 5 unit tests passed and the opt-in integration suite was skipped.
- Root `pnpm typecheck` — passed for all workspace packages.
- Root `pnpm lint` — passed with one existing Fast Refresh warning in `apps/web/src/app/layout.tsx`.
- Root `pnpm build` — passed for shared types, API, and web.
- `GET http://localhost:4000/api/v1/health` — returned `{"status":"ok","services":{"database":"up","redis":"up"}}`.

## Git workflow

- Development day: 3.
- Five meaningful commit milestones identified: tenant-safe schema and migration; Prisma and live database health; tenant-scoped persistence; PostgreSQL isolation tests; documentation and traceability.
- Actual commits created: 0. No commit was created because owner review and approval are required before committing. No hashes or new commit messages apply.
- Repository-local author identity verified as `Deepthi Devindi <deepthidevindi0@gmail.com>`. Recent existing commits were not changed.
- A read-only scan of reachable local refs found 11 existing commits with `Co-authored-by: Copilot` trailers: `8b7266e`, `f623bd2`, `970ec18`, `8d24273`, `964816b`, `a6b6381`, `0a5122c`, `17a02f4`, `c426297`, `886e37d`, and `f93561e`. No historical commits were rewritten.
- Push readiness: not ready for push; changes remain uncommitted pending owner review.

## Scope and remaining work

No public CRM CRUD routes, AI features, inventory writes, raw credential storage, or new product requirements were added. The internal repository expects an authenticated membership context from its application caller; it does not replace authentication or request-level authorization.

No Git commit or push was created.
