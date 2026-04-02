import { IsArray, IsInt, IsString, IsOptional, Min, Max, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateFixturesDto {
  @ApiPropertyOptional({ example: [6, 0], description: 'Allowed days of the week (0=Sun, 6=Sat)' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @ApiPropertyOptional({ example: '18:00', description: 'Start time for matches' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime must be in HH:mm format' })
  startTime?: string;

  @ApiPropertyOptional({ example: '22:00', description: 'End time for matches' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime must be in HH:mm format' })
  endTime?: string;

  @ApiPropertyOptional({ example: 120, description: 'Duration per match including break (minutes)' })
  @IsOptional()
  @IsInt()
  @Min(30)
  matchDuration?: number;

  @IsOptional()
  @IsString()
  matchFormat?: string;

  @ApiPropertyOptional({ example: true, description: 'Allow parallel matches if window is exceeded' })
  @IsOptional()
  @IsString() // class-transformer might handle boolean, but lets stick to standard validation or just use IsOptional.
  allowOverlap?: any;
}
