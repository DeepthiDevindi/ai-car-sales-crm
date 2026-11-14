import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { AssignBranchDto } from './auth.dto.js';

describe('AssignBranchDto', () => {
  it('accepts null to clear a branch assignment', async () => {
    const dto = plainToInstance(AssignBranchDto, { branchId: null });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('requires a valid UUID when assigning a branch', async () => {
    const dto = plainToInstance(AssignBranchDto, { branchId: 'not-a-uuid' });
    const errors = await validate(dto);

    expect(errors.map(({ property }) => property)).toContain('branchId');
  });

  it('rejects a missing branchId instead of silently preserving the old assignment', async () => {
    const dto = plainToInstance(AssignBranchDto, {});
    const errors = await validate(dto);

    expect(errors.map(({ property }) => property)).toContain('branchId');
  });
});
