import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LeagueStatus } from '@prisma/client';

export class UpdateLeagueStatusDto {
  @ApiProperty({ enum: LeagueStatus })
  @IsEnum(LeagueStatus)
  @IsNotEmpty()
  status!: LeagueStatus;
}
