// src/modules/auth/dto/reset-password.dto.ts
import { IsNotEmpty, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'โทเคนไม่ถูกต้อง' })
  @ApiProperty()
  token: string;

  @IsNotEmpty({ message: 'กรุณากรอกรหัสผ่าน' })
  @MinLength(12, { message: 'รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+\-_])[A-Za-z\d@$!%*?&#+\-_]/, {
    message: "ต้องมีตัวพิมพ์ใหญ่, เล็ก, ตัวเลข และสัญลักษณ์พิเศษ",
  })
  @ApiProperty({ example: 'NewStrongPassword123!' })
  password: string;
}
