import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTeamStatusDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  status!: string;
}
