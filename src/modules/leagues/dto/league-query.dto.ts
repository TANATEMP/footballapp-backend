// src/modules/leagues/dto/league-query.dto.ts
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeagueStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class LeagueQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LeagueStatus, example: LeagueStatus.REGISTRATION })
  @IsOptional()
  @IsEnum(LeagueStatus)
  status?: LeagueStatus;
}
