import { IsEmail, IsString, IsOptional, IsIn, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Somchai Jaidee', description: 'Full name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[\u0E00-\u0E7Fa-zA-Z\s'-]+$/, {
    message: 'Name contains invalid characters',
  })
  @Transform(({ value }: { value: any }) => value?.trim())
  name: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(255)
  @Transform(({ value }: { value: any }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    example: 'MyP@ssw0rd!2025',
    description: 'Min 12 chars, must contain uppercase, lowercase, number, special char',
    minLength: 12,
    maxLength: 128,
  })
  @IsString()
  @MinLength(15, { message: 'Password must be at least 15 characters' })
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+-_])[A-Za-z\d@$!%*?&#+-_]/,
    { message: 'Password must contain uppercase, lowercase, number, and special character' }
  )
  password: string;

  @ApiPropertyOptional({ example: 'player', enum: ['player', 'manager'], description: 'Only player or manager allowed' })
  @IsOptional()
  @IsIn(['player', 'manager'], { message: 'Role must be either player or manager' })
  @Transform(({ value }: { value: any }) => value?.toLowerCase().trim())
  role?: string;
}
