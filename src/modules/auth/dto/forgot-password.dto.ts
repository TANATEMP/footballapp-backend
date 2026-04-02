import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'อีเมลไม่ถูกต้อง' })
  @ApiProperty({ example: 'user@example.com' })
  email: string;
}
