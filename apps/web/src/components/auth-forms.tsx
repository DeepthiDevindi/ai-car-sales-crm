'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api/client';

function actionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Unable to continue. Check the credentials, link, and account eligibility.';
    }
    if (error.status === 400) {
      return 'The submitted information is invalid, or the link has expired.';
    }
    if (error.status === 409) {
      return 'This invitation conflicts with an existing account or invitation.';
    }
    return error.message;
  }
  return 'The request could not be completed. Please try again.';
}

function AuthShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="page-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">AI Car Sales Assistant & CRM Platform</p>
        <h1 id="auth-title">{title}</h1>
        {children}
      </section>
    </main>
  );
}

function Feedback({ error, message }: { error: string | null; message: string | null }) {
  return (
    <>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="form-success" role="status">{message}</p> : null}
    </>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ stage: 'ACTIVE' | 'MFA_SETUP' | 'MFA_CHALLENGE' }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            email: form.get('email'),
            password: form.get('password'),
          }),
        },
      );
      if (result.stage === 'ACTIVE') {
        router.replace('/');
      } else {
        router.replace(result.stage === 'MFA_SETUP' ? '/mfa/setup' : '/mfa/verify');
      }
      router.refresh();
    } catch (submitError) {
      setError(actionError(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Sign in">
      <form className="auth-form" onSubmit={submit}>
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required maxLength={254} />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </label>
        <Feedback error={error} message={null} />
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="auth-links"><Link href="/forgot-password">Forgot your password?</Link></p>
      <p className="auth-links"><Link href="/request-verification">Resend verification instructions</Link></p>
      <p className="auth-note">Accounts are provisioned by dealership administrators.</p>
    </AuthShell>
  );
}

export function RequestVerificationForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const email = new FormData(event.currentTarget).get('email');
    try {
      await apiRequest('/auth/email-verification/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage('If the account is eligible, instructions will be sent to that address.');
    } catch (submitError) {
      setError(actionError(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Verify your email">
      <form className="auth-form" onSubmit={submit}>
        <p>Enter your account email to request verification instructions.</p>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
        <Feedback error={error} message={message} />
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Submitting…' : 'Request instructions'}
        </button>
      </form>
      <p className="auth-links"><Link href="/login">Return to sign in</Link></p>
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const email = new FormData(event.currentTarget).get('email');
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage('If the account is eligible, instructions will be sent to that address.');
    } catch (submitError) {
      setError(actionError(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset password">
      <form className="auth-form" onSubmit={submit}>
        <p>Enter your account email to request a password reset link.</p>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
        <Feedback error={error} message={message} />
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Submitting…' : 'Request reset link'}
        </button>
      </form>
      <p className="auth-links"><Link href="/login">Return to sign in</Link></p>
    </AuthShell>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const password = new FormData(event.currentTarget).get('password');
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setMessage('Password reset. Redirecting to sign in…');
      window.setTimeout(() => {
        router.replace('/login');
        router.refresh();
      }, 1200);
    } catch (submitError) {
      setError(actionError(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Choose a new password">
      <form className="auth-form" onSubmit={submit}>
        <label>
          New password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <p className="auth-note">Use at least 12 characters and avoid common passwords.</p>
        <Feedback error={error} message={message} />
        <button className="primary-button" type="submit" disabled={loading || !token}>
          {loading ? 'Saving…' : 'Reset password'}
        </button>
        {!token ? <p className="form-error" role="alert">A reset token is required.</p> : null}
      </form>
    </AuthShell>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function verify() {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await apiRequest<{ message: string }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setMessage(result.message);
    } catch (submitError) {
      setError(actionError(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Verify your email">
      <Feedback error={error} message={message} />
      <button className="primary-button" type="button" onClick={verify} disabled={loading || !token}>
        {loading ? 'Verifying…' : 'Verify email'}
      </button>
      {!token ? <p className="form-error" role="alert">A verification token is required.</p> : null}
      <p className="auth-links"><Link href="/login">Return to sign in</Link></p>
    </AuthShell>
  );
}

export function MfaSetupForm() {
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function beginSetup() {
    setError(null);
    setLoading(true);
    try {
      setSetup(
        await apiRequest<{ secret: string; otpauthUri: string }>('/auth/mfa/setup', {
          method: 'POST',
        }),
      );
    } catch (submitError) {
      setError(actionError(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Set up multi-factor authentication">
      <p>Scan the URI with an authenticator app, or enter the secret manually.</p>
      <Feedback error={error} message={null} />
      {!setup ? (
        <button className="primary-button" type="button" onClick={beginSetup} disabled={loading}>
          {loading ? 'Preparing…' : 'Begin setup'}
        </button>
      ) : (
        <>
          <div className="secret-panel">
            <strong>Manual setup key</strong>
            <code>{setup.secret}</code>
            <a href={setup.otpauthUri}>Open in authenticator app</a>
          </div>
          <MfaChallengeForm setup />
        </>
      )}
    </AuthShell>
  );
}

export function MfaChallengeForm({ setup = false }: { setup?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const code = new FormData(event.currentTarget).get('code');
    try {
      await apiRequest('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      router.replace('/');
      router.refresh();
    } catch (submitError) {
      setError(actionError(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Authenticator code
        <input
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
        />
      </label>
      <Feedback error={error} message={null} />
      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? 'Checking…' : setup ? 'Complete setup' : 'Verify and sign in'}
      </button>
    </form>
  );
}

export function InvitationAcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ message: string }>('/auth/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({
          token,
          password: form.get('password'),
          firstName: form.get('firstName'),
          lastName: form.get('lastName'),
        }),
      });
      setMessage(result.message);
      window.setTimeout(() => router.replace('/login'), 1200);
    } catch (submitError) {
      setError(actionError(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Accept dealership invitation">
      <form className="auth-form" onSubmit={submit}>
        <label>
          First name
          <input name="firstName" autoComplete="given-name" maxLength={100} />
        </label>
        <label>
          Last name
          <input name="lastName" autoComplete="family-name" maxLength={100} />
        </label>
        <label>
          Create password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <Feedback error={error} message={message} />
        <button className="primary-button" type="submit" disabled={loading || !token}>
          {loading ? 'Accepting…' : 'Accept invitation'}
        </button>
        {!token ? <p className="form-error" role="alert">An invitation token is required.</p> : null}
      </form>
    </AuthShell>
  );
}
