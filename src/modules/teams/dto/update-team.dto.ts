import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTeamDto } from './create-team.dto';
import { TeamStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateTeamDto extends PartialType(CreateTeamDto) {
  @ApiPropertyOptional({ enum: TeamStatus, example: TeamStatus.APPROVED })
  @IsOptional()
  @IsEnum(TeamStatus)
  status?: TeamStatus;
}
