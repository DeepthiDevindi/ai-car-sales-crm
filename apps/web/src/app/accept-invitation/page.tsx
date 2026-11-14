import { InvitationAcceptForm } from '@/components/auth-forms';

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';
  return <InvitationAcceptForm token={token} />;
}
