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

## Day 5 administration traceability

The user-supplied SRS-AICRM-001 consolidated draft 1.1 is marked **DRAFT** and requires product-owner approval. The following traceability records implementation evidence against its proposed R1 requirements; it does not treat the draft as an approved contractual baseline. Suspension authority/policy, role matrix approval, and CRM branch ownership remain unresolved.

| Proposed requirement | Implementation evidence | Status |
| --- | --- | --- |
| FR-AUZ-001–005: RBAC, predefined roles, backend enforcement, deny unauthorized requests | Dealership role catalog, tenant context and permission guards | Implemented; role/permission policy still requires approval |
| FR-AUZ-006, FR-AUZ-014: dealership scope and cross-tenant denial | Tenant context derives dealership from an active membership; dealership and branch queries include the authorized dealership | Implemented; existing tenant-isolation integration suite remains the cross-tenant evidence |
| FR-AUZ-007: branch scope for Sales Managers | Branch and staff reads restrict Sales Managers to their assigned branch | Implemented; no general CRM record APIs exist yet |
| FR-AUZ-008, FR-AUZ-012–013: assigned CRM record ownership and AI authorization | No lead/customer authorization endpoints or AI workflows are implemented in this phase | Deferred until those modules exist |
| FR-AUZ-009–011: delegated role changes, audit, and refreshed decisions | Role assignment checks actor permissions, writes an audit event, and revokes sessions after a role change | Implemented in the dealership staff service |
| FR-USR-001–004: invitations, dealership membership, employee profile, role assignment | Single-use invitation acceptance creates a dealership membership; staff listing and role assignment are dealership scoped | Implemented; email delivery is not configured |
| FR-USR-005–006: activation/deactivation and protected access removal | Membership status changes and user sessions are revoked on deactivation | Implemented; active lead assignments are returned for explicit administrator review, not silently reassigned |
| FR-USR-007–008: branch assignment and employee availability | Membership branch assignment and validated weekly availability schedule | Implemented |
| FR-USR-009–010: active leads on deactivation and audit | Deactivation returns active lead assignments and writes membership/session audit events | Implemented; full CRM reassignment workflow is deferred |
| FR-DLR-001–003: unique dealership, tenant identity, contact profile | Existing unique dealership identity plus current-dealership profile read/update endpoints and dashboard | Implemented |
| FR-DLR-004: dealership opening hours | Validated weekly schedule is stored on the dealership and edited in the dashboard | Implemented |
| FR-DLR-005–006: branches and staff branch associations | Tenant-scoped branch create/read/update, branch status, employee assignment | Implemented; CRM-record branch association remains deferred |
| FR-DLR-007: dealership business settings | Timezone, currency, branding name, and default lead source are supported by the settings endpoint | Implemented; dashboard exposes timezone, currency, and branding name |
| FR-DLR-008: dealership suspension | No suspension control is exposed to dealership administrators; platform authority and suspension policy require approval | Blocked pending policy/role approval |
| FR-DLR-009: audited dealership configuration | Profile, settings, branch, employee, and role changes create audit records | Implemented |

See the [Day 5 report](../planning/day-05-report.md) for validation, migration status, and remaining acceptance gaps.
