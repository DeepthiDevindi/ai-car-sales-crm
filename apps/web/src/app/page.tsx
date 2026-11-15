import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DealershipDashboard } from '@/components/dealership-dashboard';
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

  return <DealershipDashboard session={session} />;
}
