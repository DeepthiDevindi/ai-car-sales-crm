import type { AuthSession, DealershipMembership, User } from '@prisma/client';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  auth?: {
    session: AuthSession;
    user: User;
    rawToken: string;
  };
  tenant?: {
    dealershipId: string;
    membership: DealershipMembership;
    permissions: string[];
  };
}
