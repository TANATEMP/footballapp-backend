// src/modules/user/user.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
<<<<<<< HEAD
  constructor(private prisma: PrismaService) {}
=======
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}
>>>>>>> cdd78b3140b024ca520fb8623c802b6614f08206

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
    
    // exclude passwordHash and map playerProfile to player for frontend compatibility
    const { passwordHash, playerProfile, ...result } = user;
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
