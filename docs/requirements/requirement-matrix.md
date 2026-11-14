# Requirement matrix

| ID | Requirement | Status and evidence |
| --- | --- | --- |
| R1 | Platform foundation with multi-tenant SaaS boundary | Implemented in the foundation architecture. Day 3 persistence and isolation evidence is documented in [database relationships](../architecture/database-relationships.md) and [tenant isolation](../architecture/tenant-isolation.md), with PostgreSQL integration coverage for tenant-scoped reads and composite foreign keys. |
| R2 | Secure local infrastructure and environment configuration | Implemented in the Day 2 baseline; see [Day 2 report](../planning/day-02-report.md). |
| R3 | Core health validation for API, PostgreSQL, and Redis | Implemented in the foundation. The API database check uses a live Prisma query; Day 3 wiring is covered in the [Day 3 report](../planning/day-03-report.md). |
| R4 | Shared type contracts for frontend/backend integration | Implemented in the Day 2 baseline. No Day 3 contract changes were required. |
| R5 | CI and developer workflow tooling | Implemented in the Day 2 baseline. No Day 3 workflow changes were required. |

This matrix is limited to the currently available R1-R5 baseline. The SRS and SAD documents were not present in the repository during Day 3; no additional requirement identifiers or product behaviors are inferred here.

## Day 4 authentication implementation traceability

The authentication-specific SRS/SAD and the referenced FR-AUT, FR-AUZ, FR-USR, and IR identifiers were not available. The following entries trace implementation evidence only; they do not assign or imply approved requirement IDs.

| Capability from the supplied Day 4 brief | Implementation evidence | Status |
| --- | --- | --- |
| Local authentication, session cookies, logout, and current-user lookup | Auth module/controller/service; PostgreSQL authentication integration test; protected web dashboard | Implemented and locally tested |
| Email verification and password reset | Single-use hashed tokens, generic responses, session revocation on reset; PostgreSQL integration test | Implemented and locally tested; delivery is development-only |
| MFA for privileged accounts | TOTP, AES-GCM secret encryption, replay prevention, production encryption-key validation; unit tests | Implemented; database/HTTP MFA flow not end-to-end tested |
| Tenant-scoped staff access and RBAC | Active membership guard, role-permission resolution, staff service/controller, existing tenant isolation tests | Implemented; permission keys/role bootstrap remain unprovisioned |
| Employee invitation onboarding | Single-use invitation and active membership creation; PostgreSQL integration test | Implemented and locally tested; delivery is development-only |
| Frontend login, reset/verification, invitation, MFA, and protected page routes | Next.js routes and form components; web test and production build | Implemented; no full browser/API E2E test |
| Production identity, email, initial administrator, MFA recovery, and approved policy | Not present or not approved | Blocked pending owner/product/security decisions |

See the [authentication and RBAC design](../architecture/authentication-and-rbac.md), [session management](../architecture/session-management.md), [API contract](../api/authentication.md), [security test notes](../security/authentication-testing.md), and [Day 4 report](../planning/day-04-report.md). The original R1-R5 meanings above remain unchanged.
