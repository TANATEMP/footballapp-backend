import { IsInt, IsEnum, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateMatchScoreDto {
  @ApiProperty({ example: 2, description: 'Home team score' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  homeScore!: number;

  @ApiProperty({ example: 1, description: 'Away team score' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  awayScore!: number;

  @ApiPropertyOptional({ enum: MatchStatus })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;
}
