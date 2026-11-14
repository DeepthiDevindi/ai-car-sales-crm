# Day 4 report: authentication, MFA, and dealership access

## Summary

Implemented a local authentication foundation across the NestJS API, PostgreSQL, Redis, and Next.js frontend. Day 4 development and local validation are complete for the implemented scope, but production readiness and final product acceptance remain blocked by missing requirements and operational decisions listed below.

The referenced SRS/SAD and the requested FR-AUT, FR-AUZ, FR-USR, and IR requirement identifiers were not available in the repository. No new requirement IDs or unapproved policy decisions are represented as approved.

## Completed implementation

- Added the Day 4 authentication schema and applied additive migrations for sessions, one-time tokens, employee invitations, MFA fields, and MFA-required roles. A follow-up additive migration enforces case-insensitive email uniqueness and fails safely if duplicate normalized addresses exist.
- Implemented scrypt password hashes, normalized email handling, generic login failures, opaque hashed session tokens, session expiry/revocation, CSRF tokens, email verification, password reset, and Redis-backed fail-closed rate limiting.
- Added TOTP MFA with AES-256-GCM encrypted secrets, one-step clock tolerance, replay prevention, and production startup validation for the external MFA encryption key.
- Added active-membership tenant resolution, permission guards, staff listing/invitation/deactivation/role/branch/session operations, and audit records. Access fails closed when the provisional permission data is absent.
- Added Next.js login, email verification request/consume, password reset, invitation acceptance, MFA setup/challenge, logout, and protected dashboard flows. Session tokens remain in HttpOnly cookies and are not written to browser storage.
- Added focused unit and local PostgreSQL/Redis integration tests, API/security documentation, Day 4 traceability notes, and this report.
- Added explicit DTO validation pipes for auth/staff bodies because the `tsx` development runtime does not emit Nest parameter type metadata. A live malformed login body was rejected with HTTP 400 for invalid email and an unknown field.

## Acceptance status

| Area | Status | Evidence / limitation |
| --- | --- | --- |
| Authentication schema and additive migrations | PASS | Both migrations applied; `prisma migrate status` reports schema up to date. No database reset was used. |
| Password, verification, session, logout, and password reset service flows | PASS | Local PostgreSQL/Redis integration tests passed, including token single-use and session revocation. |
| Invitation acceptance and active dealership membership | PASS | Local PostgreSQL/Redis integration test passed; second acceptance was rejected. |
| Case-insensitive account identity | PASS | Integration test confirms a case-variant duplicate is rejected. |
| MFA encryption, TOTP vector, and privileged setup trigger | PASS for tested scope | Unit tests cover the RFC vector and secret encryption; integration confirms privileged permissions route to setup and store encrypted secret material. The full MFA challenge/replay path is not end-to-end tested. |
| CSRF, tenant, and permission guards | PASS | Focused guard tests passed; the existing tenant-isolation suite also passed. |
| Frontend flows and protected routing | PASS for tested scope | Web unit tests passed; production build passed; `/login` returned HTTP 200 and unauthenticated `/` redirected to `/login`. No full browser-to-API E2E test exists. |
| HTTP DTO validation in `tsx` development runtime | PASS | Live malformed request returned HTTP 400 with class-validator errors for invalid email and unknown property. |
| Production email delivery | BLOCKED | No provider exists; verification, reset, and invitation email operations intentionally fail closed in production. Development links are not delivered. |
| Initial dealership administrator / bootstrap | BLOCKED | No public registration, seed admin, or bootstrap workflow was approved or implemented. |
| Role catalog and permissions | BLOCKED pending approval/provisioning | Permission keys and privileged role-key matching are provisional and not seeded. |
| MFA recovery and final password/session policy | BLOCKED pending approval | Recovery codes/bypass, device management, and several policy decisions remain undefined. |
| Product requirement traceability | BLOCKED | SRS/SAD and referenced authentication requirement IDs are absent. The requirements matrix records implementation evidence without inventing IDs. |

## Validation results

- `pnpm --dir apps/api prisma validate` — passed.
- `pnpm --dir apps/api prisma migrate deploy` — applied the additive case-insensitive email index migration successfully.
- `pnpm --dir apps/api prisma migrate status` — passed; schema up to date.
- `pnpm --filter @ai-car-sales-crm/api typecheck` — passed.
- `pnpm --filter @ai-car-sales-crm/api lint` — passed.
- `pnpm --filter @ai-car-sales-crm/api test` — 22 API unit tests passed; both opt-in integration suites skipped in the default run.
- `pnpm --filter @ai-car-sales-crm/web test` — 2 tests passed.
- `pnpm test` — 22 API and 2 web tests passed; 10 opt-in integration tests skipped in the default run.
- `RUN_DB_INTEGRATION_TESTS=1 pnpm --dir apps/api test:integration` — 10 tests passed: 6 tenant isolation and 4 auth persistence tests. Synthetic fixtures were cleaned up.
- `pnpm typecheck` — passed for all workspace packages.
- `pnpm lint` — passed with one existing Fast Refresh warning in `apps/web/src/app/layout.tsx`.
- `pnpm build` — passed for shared types, API, and web.
- Live `GET /api/v1/health` — returned `status: ok`, PostgreSQL `up`, and Redis `up`.
- Live web smoke checks — `/login` returned 200; unauthenticated `/` returned 307 to `/login`.
- Live malformed `POST /api/v1/auth/login` — returned 400 with DTO validation messages; no authentication attempt was made.

## Git workflow

- Development day: 4.
- Five meaningful commit milestones identified for owner review:
  1. `feat(auth): add authentication persistence and migration`
  2. `feat(api): implement sessions, password flows, and rate limits`
  3. `feat(auth): enforce MFA, RBAC, and staff access`
  4. `feat(web): add authentication and protected dashboard routes`
  5. `test(docs): verify and document Day 4 security flows`
- Actual commits created: 0. No hashes or commit messages apply; changes remain uncommitted pending owner review and approval.
- Repository-local Git configuration: `Deepthi Devindi <deepthidevindi0@gmail.com>`.
- No Copilot co-author trailer was added. Existing history was not rewritten. One existing recent commit uses the display name `DeepthiDevindi`; it was left unchanged.
- Git status: not clean; Day 4 changes and pre-existing workspace edits remain uncommitted. No files were staged.
- Push readiness: not ready. Owner review/commit approval is required, and production blockers remain. No push was made.

## Explicitly not done

No Day 5 work, commit, push, history rewrite, database reset, container reset, or production configuration change was performed. No actual MFA key or email credential was added to the repository.
