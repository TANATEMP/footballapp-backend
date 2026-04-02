import { IsUUID, IsDateString, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchStatus } from '@prisma/client';

export class CreateMatchDto {
  @ApiProperty({ example: '223e4567-e89b-12d3-a456-426614174001', description: 'League UUID' })
  @IsUUID()
  leagueId: string;

  @ApiProperty({ example: '323e4567-e89b-12d3-a456-426614174002', description: 'Home Team UUID' })
  @IsUUID()
  homeTeamId: string;

  @ApiProperty({ example: '423e4567-e89b-12d3-a456-426614174003', description: 'Away Team UUID' })
  @IsUUID()
  awayTeamId: string;

  @ApiProperty({ example: '2025-10-10T20:00:00Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ enum: MatchStatus, default: MatchStatus.SCHEDULED })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  homeScore?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  awayScore?: number;
}
