import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { HealthDashboard } from '@/components/health-dashboard';
import { LogoutButton } from '@/components/logout-button';
import type { AuthMeResponse } from '@/lib/api/auth';

export default async function Page() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('crm_session')?.value;
  if (!sessionCookie) {
    redirect('/login');
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    headers: { cookie: `crm_session=${sessionCookie}` },
    cache: 'no-store',
  });
  if (response.status === 401) {
    redirect('/login');
  }
  if (response.status === 403) {
    redirect('/access-denied');
  }
  if (!response.ok) {
    throw new Error('Unable to validate the current session.');
  }

  const session = (await response.json()) as AuthMeResponse;
  if (session.memberships.length === 0) {
    redirect('/access-denied');
  }

  const displayName =
    [session.user.firstName, session.user.lastName].filter(Boolean).join(' ') ||
    session.user.email;

  return (
    <main className="page-shell">
      <div className="page-card">
        <header className="hero dashboard-hero">
          <div>
            <p className="eyebrow">AI Car Sales Assistant & CRM Platform</p>
            <h1>Development Environment</h1>
            <p className="signed-in">Signed in as {displayName}</p>
          </div>
          <LogoutButton csrfToken={session.csrfToken} />
        </header>

        <HealthDashboard />
      </div>
    </main>
  );
}
