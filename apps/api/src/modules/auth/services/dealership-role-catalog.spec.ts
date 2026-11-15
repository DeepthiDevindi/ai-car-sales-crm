import { describe, expect, it } from 'vitest';
import { BUILT_IN_DEALERSHIP_ROLES } from './dealership-role-catalog.js';

describe('built-in dealership role catalog', () => {
  it('requires MFA for Dealer Administrators and excludes platform administration', () => {
    const administrator = BUILT_IN_DEALERSHIP_ROLES.find(
      ({ key }) => key === 'DEALER_ADMIN',
    );

    expect(administrator?.requiresMfa).toBe(true);
    expect(administrator?.permissionKeys).toContain('staff.assign_privileged_roles');
    expect(administrator?.permissionKeys).not.toContain('platform.settings.manage');
    expect(BUILT_IN_DEALERSHIP_ROLES.some(({ key }) => key === 'SUPER_ADMIN')).toBe(false);
  });

  it('keeps Sales Manager and Sales Agent out of dealership administration', () => {
    const manager = BUILT_IN_DEALERSHIP_ROLES.find(({ key }) => key === 'SALES_MANAGER');
    const agent = BUILT_IN_DEALERSHIP_ROLES.find(({ key }) => key === 'SALES_AGENT');

    expect(manager?.permissionKeys).toContain('branches.read');
    expect(manager?.permissionKeys).toContain('staff.read');
    expect(manager?.permissionKeys).not.toContain('branches.manage');
    expect(manager?.permissionKeys).not.toContain('staff.assign_roles');
    expect(agent?.permissionKeys).toEqual(['dashboard.read', 'system_health.read']);
  });
});
