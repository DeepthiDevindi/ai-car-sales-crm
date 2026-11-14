'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api/client';

export function LogoutButton({ csrfToken }: { csrfToken: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    setError(null);
    try {
      await apiRequest<void>('/auth/logout', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      router.replace('/login');
      router.refresh();
    } catch {
      setError('Unable to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="logout-control">
      <button className="secondary-button" type="button" onClick={logout} disabled={loading}>
        {loading ? 'Signing out…' : 'Sign out'}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
