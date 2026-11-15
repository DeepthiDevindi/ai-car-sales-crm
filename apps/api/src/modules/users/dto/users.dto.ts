import { IsIn, IsOptional } from 'class-validator';
import { IsWeeklySchedule, type WeeklySchedule } from '../../../common/weekly-schedule.js';
import { BranchQueryDto } from '../../branches/dto/branch.dto.js';

export class StaffListQueryDto extends BranchQueryDto {}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsWeeklySchedule()
  availability?: WeeklySchedule | null;
}

export class InvitationListQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'EXPIRED', 'ACCEPTED', 'REVOKED'])
  status?: 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';

}
