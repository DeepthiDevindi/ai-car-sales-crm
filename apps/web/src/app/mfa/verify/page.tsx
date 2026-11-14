import { MfaChallengeForm } from '@/components/auth-forms';

export default function MfaVerifyPage() {
  return (
    <main className="page-shell">
      <section className="auth-card" aria-labelledby="mfa-title">
        <p className="eyebrow">AI Car Sales Assistant & CRM Platform</p>
        <h1 id="mfa-title">Verify your identity</h1>
        <p>Enter the current six-digit code from your authenticator app.</p>
        <MfaChallengeForm />
      </section>
    </main>
  );
}
