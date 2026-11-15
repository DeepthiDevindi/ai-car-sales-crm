import { apiRequest } from './client';

export interface AuthMembership {
  id: string;
  dealershipId: string;
  dealershipName: string;
  branchId: string | null;
  isPrimary: boolean;
  permissions: string[];
  roles: Array<{
    id: string;
    key: string;
    name: string;
    permissions: string[];
  }>;
}

export interface AuthMeResponse {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  memberships: AuthMembership[];
  csrfToken: string;
}

export async function getCurrentSession(): Promise<AuthMeResponse> {
  return apiRequest<AuthMeResponse>('/auth/me', { cache: 'no-store' });
}
