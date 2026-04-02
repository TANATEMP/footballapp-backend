import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

@Injectable()
export class PlayersService {
  constructor(private prisma: PrismaService) {}

  async validateJerseyNumber(teamId: string, number: number, excludePlayerId?: string) {
    if (!teamId || !number) return;
    
    const existing = await this.prisma.player.findFirst({
      where: {
        teamId,
        number,
        id: excludePlayerId ? { not: excludePlayerId } : undefined,
      },
    });

    if (existing) {
      throw new BadRequestException(`Jersey number ${number} is already taken in this team.`);
    }
  }

  async create(dto: CreatePlayerDto | any, userId?: string) {
    const teamId = dto.teamId

    if (teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        include: { league: true, _count: { select: { players: true } } },
      });

      if (team?.league) {
        if (team._count.players >= team.league.maxPlayers) {
          throw new BadRequestException(
            `Cannot add more players. Team has reached the league maximum of ${team.league.maxPlayers} players.`
          );
        }
      }

      if (dto.number) {
        await this.validateJerseyNumber(teamId, dto.number);
      }
    }

    return this.prisma.player.create({
      data: {
        name: dto.name,
        number: dto.number || null,
        position: dto.position,
        teamId: teamId || null,
        userId: userId || dto.userId || null,
      },
    });
  }

  async findAll(dto: PaginationDto, teamId?: string) {
    const where = teamId ? { teamId } : {};
    const { page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      this.prisma.player.findMany({
        where,
        skip,
        take: limit,
        include: { 
          team: { select: { id: true, name: true } },
          stats: true,
        },
      }),
      this.prisma.player.count({ where }),
    ]);

    return buildPaginatedResponse(rows, count, dto);
  }

  async findOne(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: { team: true, stats: true },
    });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }

  async findMe(userId: string) {
    const player = await this.prisma.player.findUnique({
      where: { userId },
      include: { 
        team: { 
          include: { 
             league: true,
             manager: { select: { name: true } }
          } 
        }, 
        stats: true 
      },
    });
    if (!player) throw new NotFoundException('Player profile not created yet.');
    return player;
  }

  async checkOwnership(playerId: string, user: any) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: { team: true }
    });

    if (!player) throw new NotFoundException('Player not found');

    if (user.role === UserRole.ADMIN) return player;

    if (user.role === UserRole.PLAYER && player.userId !== user.sub) {
      throw new ForbiddenException('You do not have permission to manage this player profile');
    }

    if (user.role === UserRole.MANAGER) {
      if (!player.teamId || player.team?.managerId !== user.sub) {
        throw new ForbiddenException('You can only manage players in your own team');
      }
    }

    return player;
  }

  async update(id: string, dto: UpdatePlayerDto | any, user?: any) {
    if (user) {
      await this.checkOwnership(id, user);
    } else {
      await this.findOne(id);
    }
    const data: any = { ...dto };
    if (data.teamId) data.teamId = data.teamId;
    delete data.teamId;

    if (data.number && data.teamId) {
      await this.validateJerseyNumber(data.teamId, data.number, id);
    } else if (data.number) {
      const player = await this.findOne(id);
      if (player.teamId) {
        await this.validateJerseyNumber(player.teamId, data.number, id);
      }
    }

    return this.prisma.player.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.player.delete({ where: { id } });
    return { success: true };
  }
}
