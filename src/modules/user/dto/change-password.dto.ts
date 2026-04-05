import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'MyOldPassword123!', description: 'The current password of the user' })
  @IsString()
  oldPassword!: string;

  @ApiProperty({ example: 'MyNewSecretPassword456!@#', description: 'The new password to set (at least 15 characters)' })
  @IsString()
  @MinLength(15, { message: 'Password must be at least 15 characters long' })
  newPassword!: string;
}
