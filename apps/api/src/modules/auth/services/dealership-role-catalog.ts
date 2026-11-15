import { RoleScope, type Prisma } from '@prisma/client';

type RoleDefinition = {
  key: string;
  name: string;
  requiresMfa: boolean;
  permissionKeys: readonly string[];
};

const sharedPermissions = [
  { key: 'dashboard.read', name: 'View dealership dashboard' },
  { key: 'dealership.read', name: 'View dealership profile' },
  { key: 'dealership.update', name: 'Update dealership profile' },
  { key: 'dealership.settings.read', name: 'View dealership settings' },
  { key: 'dealership.settings.update', name: 'Update dealership settings' },
  { key: 'branches.read', name: 'View dealership branches' },
  { key: 'branches.manage', name: 'Manage dealership branches' },
  { key: 'staff.read', name: 'View dealership employees' },
  { key: 'staff.invite', name: 'Invite dealership employees' },
  { key: 'staff.manage', name: 'Manage dealership employees' },
  { key: 'staff.assign_roles', name: 'Assign dealership roles' },
  { key: 'staff.assign_privileged_roles', name: 'Assign privileged dealership roles' },
  { key: 'staff.revoke_sessions', name: 'Revoke dealership employee sessions' },
  { key: 'invitations.read', name: 'View dealership invitations' },
  { key: 'invitations.manage', name: 'Manage dealership invitations' },
  { key: 'roles.read', name: 'View dealership roles' },
  { key: 'system_health.read', name: 'View system health' },
] as const;

const allPermissionKeys = sharedPermissions.map(({ key }) => key);

export const BUILT_IN_DEALERSHIP_ROLES: readonly RoleDefinition[] = [
  {
    key: 'DEALER_ADMIN',
    name: 'Dealer Administrator',
    requiresMfa: true,
    permissionKeys: allPermissionKeys,
  },
  {
    key: 'SALES_MANAGER',
    name: 'Sales Manager',
    requiresMfa: false,
    permissionKeys: [
      'dashboard.read',
      'branches.read',
      'staff.read',
      'roles.read',
      'system_health.read',
    ],
  },
  {
    key: 'SALES_AGENT',
    name: 'Sales Agent',
    requiresMfa: false,
    permissionKeys: ['dashboard.read', 'system_health.read'],
  },
];

export async function provisionBuiltInDealershipRoles(
  transaction: Prisma.TransactionClient,
  dealershipId: string,
) {
  const permissions = new Map<string, string>();
  for (const definition of sharedPermissions) {
    const permission = await transaction.permission.upsert({
      where: { key: definition.key },
      create: {
        key: definition.key,
        name: definition.name,
        description: definition.name,
      },
      update: {
        name: definition.name,
        description: definition.name,
      },
      select: { id: true, key: true },
    });
    permissions.set(permission.key, permission.id);
  }

  const roles = new Map<string, { id: string; key: string; name: string; requiresMfa: boolean }>();
  for (const definition of BUILT_IN_DEALERSHIP_ROLES) {
    const role = await transaction.role.upsert({
      where: {
        dealershipId_key: {
          dealershipId,
          key: definition.key,
        },
      },
      create: {
        dealershipId,
        key: definition.key,
        name: definition.name,
        scope: RoleScope.DEALERSHIP,
        requiresMfa: definition.requiresMfa,
      },
      update: {
        name: definition.name,
        scope: RoleScope.DEALERSHIP,
        requiresMfa: definition.requiresMfa,
      },
      select: { id: true, key: true, name: true, requiresMfa: true },
    });

    const desiredPermissionIds = definition.permissionKeys.map((key) => {
      const permissionId = permissions.get(key);
      if (!permissionId) {
        throw new Error(`Built-in permission "${key}" is not provisioned.`);
      }
      return permissionId;
    });
    const desiredPermissionIdSet = new Set(desiredPermissionIds);
    const currentAssignments = await transaction.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionId: true },
    });
    const obsoletePermissionIds = currentAssignments
      .map(({ permissionId }) => permissionId)
      .filter((permissionId) => !desiredPermissionIdSet.has(permissionId));
    if (obsoletePermissionIds.length > 0) {
      await transaction.rolePermission.deleteMany({
        where: {
          roleId: role.id,
          permissionId: { in: obsoletePermissionIds },
        },
      });
    }

    const existingPermissionIds = new Set(
      currentAssignments.map(({ permissionId }) => permissionId),
    );
    const missingPermissionIds = desiredPermissionIds.filter(
      (permissionId) => !existingPermissionIds.has(permissionId),
    );
    if (missingPermissionIds.length > 0) {
      await transaction.rolePermission.createMany({
        data: missingPermissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }
    roles.set(role.key, role);
  }
  return roles;
}
