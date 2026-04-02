import { IsUUID, IsEnum, IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EventType } from '@prisma/client';

export class MatchEventDto {
  @ApiProperty({ example: '323e4567-e89b-12d3-a456-426614174002', description: 'Team UUID' })
  @IsUUID()
  teamId: string;

  @ApiProperty({ example: '523e4567-e89b-12d3-a456-426614174004', description: 'Player UUID' })
  @IsOptional()
  @IsUUID()
  playerId?: string;

  @ApiProperty({ enum: EventType, example: EventType.GOAL })
  @IsEnum(EventType)
  type: EventType;

  @ApiProperty({ example: 45, description: 'Minute of the match' })
  @IsNumber()
  @Min(0)
  minute: number;
}
