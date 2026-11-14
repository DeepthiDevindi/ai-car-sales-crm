# Session management

## Session lifecycle

1. `POST /api/v1/auth/login` verifies an active, email-verified account and its scrypt password hash.
2. The API generates a cryptographically random 256-bit opaque token. PostgreSQL stores only the token's SHA-256 hash.
3. Ordinary accounts receive an active session with an eight-hour expiry. Accounts requiring MFA receive a ten-minute `MFA_SETUP` or `MFA_CHALLENGE` session instead.
4. Successful MFA rotates the pending token in the same session row and changes the stage to `ACTIVE`; the prior token immediately stops resolving.
5. `GET /api/v1/auth/me` validates the cookie-backed session and returns the user, active memberships, and a session-bound CSRF token.
6. `POST /api/v1/auth/logout` requires the CSRF token, revokes the session, records an audit event, and clears the cookie.

The cookie name is `crm_session`. It is HttpOnly, SameSite=Lax, scoped to `/`, and Secure in production. The API clears invalid session cookies when the session guard rejects them. Browser API calls include credentials; the web application never writes the session token to local or session storage.

## Revocation

- Password reset revokes every active session for the user and consumes outstanding password-reset tokens.
- Deactivating a membership, changing a role, or changing a branch revokes every active session for the affected user.
- Administrators may revoke all sessions for a dealership membership's user.
- Session revocation is user-wide because sessions are not dealership-bound. Other memberships remain, but the employee must authenticate again.
- Session expiry, revoked state, account status, email verification, and MFA stage are checked against PostgreSQL on authenticated requests.

## CSRF and browser origin controls

- State-changing authenticated requests use `X-CSRF-Token`, computed as an HMAC of the session identifier with the session token as the key.
- Login and public token operations validate the browser `Origin` against configured `CORS_ORIGIN`; production requests without an Origin are rejected.
- CORS allows credentialed requests only from configured origins and explicitly allows `X-CSRF-Token` and `X-Dealership-Id`.
- The web application sets a `no-referrer` policy to avoid forwarding token-bearing page URLs as referrers.

## Rate limits and dependency failure

Authentication rate limits are fixed-window counters in Redis, keyed by a SHA-256 digest of the limiter identifier. Redis failures fail closed with HTTP 503; exceeded limits return HTTP 429. Rate-limit counters expire automatically. They are not an in-memory fallback.

## Configuration and operations

Set `AUTH_MFA_ENCRYPTION_KEY` to a base64-encoded random 32-byte key in the local API environment. Production startup requires it. Never commit the key or include it in a report. Key rotation and recovery procedures remain undefined; do not rotate a production key without an approved migration/re-enrollment plan.

Session duration, refresh-token behavior, device/session listing, remembered devices, concurrent-session limits, and alerting remain unapproved and are not implemented.
