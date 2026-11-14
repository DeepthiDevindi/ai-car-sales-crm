# Authentication and role-based access control

## Status and source of truth

This is the Day 4 implementation record, not an approved product security specification. The SRS/SAD and the referenced authentication requirement identifiers were not present in the repository. Password rules, role keys, permission keys, onboarding, recovery, and production email behavior must be confirmed before production use.

Authentication is implemented in the NestJS modular monolith under `apps/api/src/modules/auth`. The frontend routes are in `apps/web/src/app`. Authentication does not grant dealership access by itself; every dealership operation must also establish an active membership context.

## Identity and passwords

- Emails are normalized to lowercase by request DTOs. PostgreSQL also has an additive unique index on `lower("email")`; migration `20261114200000_case_insensitive_user_email` fails rather than silently proceeding if duplicate case-insensitive addresses exist.
- Passwords are hashed asynchronously with Node.js scrypt (`N=32768`, `r=8`, `p=1`, 64-byte derived key, random 16-byte salt). Stored hashes include parameters and salt, not the password.
- The provisional development policy is 12–128 characters plus a small common-password deny list. This is not an approved production policy.
- Login uses a dummy scrypt hash for unknown users, returns a generic credential failure, and requires an active, email-verified account.
- Public registration and initial administrator bootstrap are deliberately absent. A dealership administrator must already exist and have permission to invite staff.

## Session and MFA

- The browser receives a random 256-bit opaque session token in an HttpOnly, SameSite=Lax cookie. Production cookies are Secure. Only a SHA-256 token hash is stored in PostgreSQL.
- Normal sessions expire after eight hours. MFA setup/challenge sessions expire after ten minutes and are not accepted by the normal session guard.
- Privileged global roles, roles marked `requiresMfa`, and the provisional `DEALER_ADMIN` / `SUPER_ADMIN` role keys require TOTP enrollment or challenge before a normal session is issued.
- MFA secrets are encrypted with AES-256-GCM. `AUTH_MFA_ENCRYPTION_KEY` must be a canonical base64-encoded 32-byte key; production startup rejects a missing or malformed key. The key must be stored outside source control and backed up according to the eventual operations policy.
- TOTP verification allows a one-step clock window and stores the last accepted counter to reject replay. Recovery codes and MFA bypass are not implemented because no recovery policy was approved.
- CSRF tokens are HMAC-bound to the active session token and session ID. State-changing authenticated requests require `X-CSRF-Token`; `GET`, `HEAD`, and `OPTIONS` are exempt.

## Dealership isolation and permissions

For staff APIs, the caller supplies `X-Dealership-Id`. The tenant guard loads an active membership for the authenticated user and active dealership, then resolves permission keys only through that membership's assigned roles. The permission guard denies requests unless every required permission is present.

The staff API currently uses these provisional permission keys:

- `staff.read`
- `staff.invite`
- `staff.manage`
- `staff.assign_roles`
- `staff.assign_privileged_roles`
- `staff.revoke_sessions`

These keys and the role-key checks are not seeded by this change. Requests fail closed until authorized role/permission data is provisioned. The exact role catalog and assignment policy require product/security approval. Possession of `staff.assign_privileged_roles` also requires MFA at login, even if a custom role does not set `requiresMfa`.

Staff invitation, deactivation, role/branch change, session revocation, login, logout, password reset, and MFA enrollment are audited. User-level sessions are shared across memberships; changing or deactivating a dealership membership revokes all sessions for that user, including sessions that could otherwise serve other dealerships. The user must sign in again.

## Email and onboarding limitation

There is no production email provider. In development, verification, reset, and invitation links are written to the API log with an explicit “not delivered” warning; tests capture links in memory. Production email operations fail closed. Do not enable production onboarding until a provider, verified sender/domain, delivery monitoring, and abuse policy are configured.

An invitation can create a new account only; invitations to an existing account are rejected. There is no public registration, initial-admin seed, role bootstrap, account merge, or MFA recovery path.

## Related code and evidence

- Auth endpoints and cookies: `apps/api/src/modules/auth/auth.controller.ts`
- Auth/session lifecycle: `apps/api/src/modules/auth/auth.service.ts`
- Tenant and permission guards: `apps/api/src/modules/auth/guards`
- Staff operations: `apps/api/src/modules/auth/services/staff.service.ts`
- Frontend auth forms: `apps/web/src/components/auth-forms.tsx`
- Database schema: `apps/api/prisma/schema.prisma`
- Integration evidence: `apps/api/src/modules/auth/auth.integration.spec.ts`
- Current unresolved decisions: [open questions](../decisions/open-questions.md)
