# Day 2 report

## Root cause

The PostgreSQL container had been configured to publish host port `5433`, which conflicted with an existing Windows PostgreSQL service running on `5433` and a separate local PostgreSQL instance running on `5432`. The project also had a malformed `DATABASE_URL` in the app environment file (`DATABASE_URL=DATABASE_URL=...`), which prevented the backend from using the intended connection parameters reliably.

## Original port conflict

Docker Desktop was publishing PostgreSQL on `127.0.0.1:5433`, while an unrelated Windows PostgreSQL listener was already bound to `5433`. A separate system-level PostgreSQL process was also using port `5432`, so the project could not safely reuse the default ports without collisions.

## Selected PostgreSQL host port

The project was moved to `127.0.0.1:55432` mapped to the container's internal port `5432`.

## Configuration files changed

- `docker-compose.yml` — corrected the PostgreSQL host mapping to `127.0.0.1:55432:5432`.
- `apps/api/.env` — corrected the local `DATABASE_URL` and removed the duplicated `DATABASE_URL=` prefix.
- `apps/api/.env.example` — updated to match the working local PostgreSQL port.
- `apps/api/src/config/app.config.ts` — updated the fallback database URL to the correct host port.
- `README.md` — updated local startup and infrastructure instructions.

## Container status

PASS — The PostgreSQL container was recreated without deleting the existing named volume. It started successfully and reported healthy status.

## PostgreSQL authentication results

PASS — Authentication succeeded both inside the container and through the Windows host port at `127.0.0.1:55432` using the configured `crm_app` user and `ai_car_sales_crm` database.

## Prisma migration results

PASS — `pnpm db:generate` succeeded and `pnpm db:migrate` applied the initial migration without resetting the database.

## Backend health-check results

PASS — `GET http://localhost:4000/api/v1/health` returned HTTP 200 with:

```json
{"status":"ok","services":{"database":"up","redis":"up"}}
```

## Test results

PASS — `pnpm test`, `pnpm typecheck`, and `pnpm build` all completed successfully.

## Remaining blockers

No blockers remain for the Day 2 foundation work in this environment. The project is now running successfully on the selected PostgreSQL host port `55432` and the application stack is healthy.
