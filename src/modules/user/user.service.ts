import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as argon2 from 'argon2';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { 
        team: {
          include: { league: true }
        },
        playerProfile: {
          include: {
            stats: true,
            team: {
              include: { 
                league: true,
                manager: { select: { name: true } }
              }
            }
          }
        }
      },
    });
    
    if (!user) throw new NotFoundException('User not found');
    
    const { 
      passwordHash, 
      twoFactorSecret, 
      resetToken, 
      resetTokenExpires, 
      playerProfile, 
      ...result 
    } = user;

    return {
      ...result,
      player: playerProfile
    };
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!user.passwordHash) {
      throw new BadRequestException('บัญชีนี้ล็อกอินผ่านระบบอื่น (เช่น Google) และไม่มีรหัสผ่าน');
    }

    const isMatch = await argon2.verify(user.passwordHash, dto.oldPassword);
    if (!isMatch) {
      throw new BadRequestException('รหัสผ่านเดิมไม่ถูกต้อง');
    }

    const hashedNewPassword = await argon2.hash(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedNewPassword },
    });

    return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จแล้ว' };
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return users.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.isActive ? 'ACTIVE' : 'BANNED',
      joinedDate: user.createdAt,
    }));
  }

  async updateStatus(id: string, newStatus: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const isActive = newStatus === 'ACTIVE';

    await this.prisma.user.update({
      where: { id },
      data: { isActive },
    });

    return { success: true, status: newStatus };
  }
}
