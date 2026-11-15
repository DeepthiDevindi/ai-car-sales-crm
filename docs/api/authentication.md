# Authentication API

Base URL: `http://localhost:4000/api/v1`. The web client sends cookies with requests; session tokens are never returned in JSON or stored by the frontend.

## Public or pending-session routes

| Method and path | Purpose | Notes |
| --- | --- | --- |
| `POST /auth/login` | Verify email/password and set a session cookie | Returns `stage` (`ACTIVE`, `MFA_SETUP`, or `MFA_CHALLENGE`); active responses include a CSRF token. |
| `POST /auth/email-verification/request` | Request verification instructions | Generic response to avoid account enumeration; delivery is development-only. |
| `POST /auth/verify-email` | Consume a single-use verification token | Body: `{ "token": "..." }`. |
| `POST /auth/forgot-password` | Request reset instructions | Generic response; delivery is development-only. |
| `POST /auth/reset-password` | Consume a reset token and set a new password | Body: `{ "token": "...", "password": "..." }`; revokes all user sessions. |
| `POST /auth/mfa/setup` | Create encrypted TOTP secret for an MFA setup session | Sets up a pending account; returns the one-time setup secret and `otpauthUri`. No active-session CSRF token is required for a pending MFA session. |
| `POST /auth/mfa/verify` | Verify TOTP and activate/rotate the session | Body: `{ "code": "123456" }`; consumes each counter at most once. |
| `POST /auth/invitations/accept` | Accept a single-use dealership invite | Requires token and a new password; creates an active, verified user and dealership membership. |

## Authenticated routes

| Method and path | Purpose | Required headers |
| --- | --- | --- |
| `GET /auth/me` | Validate current session and return user, active memberships, and CSRF token | Session cookie |
| `POST /auth/logout` | Revoke current session | Session cookie and `X-CSRF-Token` |

## Dealership staff routes

All staff routes require an active session, `X-CSRF-Token` on state-changing requests, and an authorized `X-Dealership-Id`.

| Method and path | Provisional permission |
| --- | --- |
| `GET /users/staff` | `staff.read` |
| `POST /users/staff/invitations` | `staff.invite` |
| `PATCH /users/staff/:membershipId/deactivate` | `staff.manage` |
| `PUT /users/staff/:membershipId/roles` | `staff.assign_roles` |
| `PATCH /users/staff/:membershipId/branch` | `staff.manage` |
| `POST /users/staff/:membershipId/sessions/revoke` | `staff.revoke_sessions` |

Assigning an MFA-required or privileged role also requires the provisional `staff.assign_privileged_roles` permission. Role and permission provisioning is not included.

## Browser and error behavior

- Login, verification/reset requests, token consumption, invitation acceptance, MFA setup, and MFA challenge validate the browser origin against `CORS_ORIGIN`.
- CORS credentials are enabled only for configured origins. Allowed custom headers include `X-CSRF-Token` and `X-Dealership-Id`.
- Invalid credentials use a generic unauthorized response. Rate limiting returns 429; a Redis outage returns 503.
- Verification, reset, and invitation email links are only captured in memory by the test sink. The development sink logs a not-delivered warning without logging tokens. A real production mail adapter is a prerequisite for production use.

The SRS/SAD and exact authentication requirement identifiers are absent. This contract records current code behavior and must not be treated as final product approval.
