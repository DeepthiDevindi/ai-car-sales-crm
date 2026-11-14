import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { AuthenticatedRequest } from '../auth.types.js';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) {
      throw new UnauthorizedException('Authentication is required.');
    }

    const dealershipId = request.headers['x-dealership-id'];
    if (typeof dealershipId !== 'string' || dealershipId.length === 0) {
      throw new ForbiddenException('An authorized dealership context is required.');
    }

    const membership = await this.prisma.dealershipMembership.findFirst({
      where: {
        userId: request.auth.user.id,
        dealershipId,
        status: MembershipStatus.ACTIVE,
        dealership: { status: 'ACTIVE' },
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('The selected dealership is not authorized.');
    }

    request.tenant = {
      dealershipId,
      membership,
      permissions: [
        ...new Set(
          membership.roles.flatMap(({ role }) =>
            role.permissions.map(({ permission }) => permission.key),
          ),
        ),
      ],
    };
    return true;
  }
}
