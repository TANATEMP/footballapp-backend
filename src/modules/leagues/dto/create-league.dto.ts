import { IsString, IsDateString, IsEnum, IsNumber, IsOptional, MinLength, MaxLength, IsArray, IsInt, Min, Max, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeagueStatus } from '@prisma/client';

export class CreateLeagueDto {
  @ApiProperty({ example: 'Bangkok Premier League' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'League description here...' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2025' })
  @IsString()
  @MaxLength(20)
  season: string;

  @ApiProperty({ example: '2025-01-01' })
  @IsDateString()
  start_date: string;

  @ApiProperty({ example: '2025-12-31' })
  @IsDateString()
  end_date: string;

  @ApiProperty({ enum: LeagueStatus, default: LeagueStatus.REGISTRATION })
  @IsEnum(LeagueStatus)
  status: LeagueStatus;

  @ApiProperty({ example: 20, default: 20 })
  @IsNumber()
  @IsOptional()
  maxTeams?: number;

  @ApiProperty({ example: 11, default: 11 })
  @IsNumber()
  @IsOptional()
  minPlayers?: number;

  @ApiProperty({ example: 25, default: 25 })
  @IsNumber()
  @IsOptional()
  maxPlayers?: number;

  @ApiProperty({ example: '2025-01-01T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  registrationStart?: string;

  @ApiProperty({ example: '2025-01-31T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  registrationEnd?: string;

  // --- Scheduling Defaults ---

  @ApiPropertyOptional({ example: [6, 0] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  startTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  endTime?: string;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(30)
  matchDuration?: number;

  @ApiPropertyOptional({ example: 'SINGLE' })
  @IsOptional()
  @IsString()
  matchFormat?: string;
}
