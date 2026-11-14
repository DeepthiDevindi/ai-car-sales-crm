# Northstar Dealer CRM

A monorepo for the AI Car Sales Assistant & Customer Relationship Management platform, built with Next.js, NestJS, PostgreSQL, Redis, Prisma, and pnpm workspaces.

## Local startup

```bash
pnpm install
pnpm infra:up
pnpm db:generate
pnpm db:migrate
pnpm dev
```

The project uses Docker Compose for local PostgreSQL and Redis infrastructure. PostgreSQL is bound to `127.0.0.1:55432` to avoid the existing Windows service conflict on port 5432.

## Local infrastructure

- PostgreSQL: `127.0.0.1:55432` -> container `5432`
- Redis: `127.0.0.1:6379` -> container `6379`
- API: `http://localhost:4000/api/v1`
- Web app: `http://localhost:3000`

## Health checks

- Backend health endpoint: `GET http://localhost:4000/api/v1/health`
- Expected result: `status: "ok"` when PostgreSQL and Redis are reachable.

## Database validation

- Database model and relationship notes: [database schema](docs/architecture/database-schema.md) and [database relationships](docs/architecture/database-relationships.md).
- Tenant boundary rules: [tenant isolation](docs/architecture/tenant-isolation.md).
- PostgreSQL integration tests use synthetic records and are disabled by default. With local PostgreSQL running and `apps/api/.env` configured, enable them in PowerShell with:

```powershell
$env:RUN_DB_INTEGRATION_TESTS = '1'
pnpm --dir apps/api test:integration
Remove-Item Env:\RUN_DB_INTEGRATION_TESTS
```

## Available scripts

- `pnpm dev` — start the API and web frontend together.
- `pnpm build` — type-check and build all packages.
- `pnpm lint` — run lint checks across the workspace.
- `pnpm test` — run project tests.
- `pnpm infra:up` — start PostgreSQL and Redis via Docker Compose.
- `pnpm db:generate` — generate the Prisma client.
- `pnpm db:migrate` — apply Prisma migrations to the local database.
