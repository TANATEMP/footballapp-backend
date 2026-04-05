import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(255)
  @Transform(({ value }: { value: any }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: 'MyP@ssw0rd!2025' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: '123456', required: false })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @IsOptional()
  twoFactorCode?: string;
}
