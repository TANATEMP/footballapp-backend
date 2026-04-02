import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinLeagueDto {
  @ApiProperty()
  @IsUUID()
  leagueId!: string;
}
