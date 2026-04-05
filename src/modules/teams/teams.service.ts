import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UserRole, LeagueStatus, TeamStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTeamDto | any, userId?: string) {
    return this.prisma.team.create({
      data: {
        name: dto.name,
        shortName: dto.shortName,
        leagueId: dto.leagueId || null,
        managerId: dto.managerId || userId,
        logoUrl: dto.logoUrl || null,
      },
      include: { league: true },
    });
  }

  async findAll(dto: PaginationDto, leagueId?: string) {
    const where = leagueId ? { leagueId } : {};
    const { page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      this.prisma.team.findMany({
        where,
        skip,
        take: limit,
        include: { league: true, manager: true },
      }),
      this.prisma.team.count({ where }),
    ]);

    return buildPaginatedResponse(rows, count, dto);
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: { league: true, manager: true, players: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async checkOwnership(teamId: string, user: any) {
    const team = await this.findOne(teamId);
    if (user.role !== UserRole.ADMIN && team.managerId !== user.sub) {
      throw new ForbiddenException('You do not have permission to manage this team');
    }
    return team;
  }

  async uploadLogo(teamId: string, logoBuffer: Buffer, filename: string) {
    const logoUrl = `https://storage.provider.com/logos/${filename}`;
    await this.findOne(teamId);
    await this.prisma.team.update({
      where: { id: teamId },
      data: { logoUrl },
    });
    return { logo_url: logoUrl };
  }

  async update(id: string, dto: UpdateTeamDto | any) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (data.leagueId) data.leagueId = data.leagueId;
    if (data.managerId) data.managerId = data.managerId;
    if (data.logoUrl) data.logoUrl = data.logoUrl;
    delete data.leagueId;
    delete data.managerId;
    delete data.logoUrl;

    return this.prisma.team.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.team.delete({ where: { id } });
    return { success: true };
  }

  async updateStatus(id: string, status: string) {
    const team = await this.findOne(id);
    
    if (status === 'APPROVED' && team.leagueId) {
      const league = await this.prisma.league.findUnique({
        where: { id: team.leagueId },
        include: {
          _count: {
            select: { teams: { where: { status: 'APPROVED' } } }
          }
        }
      });

      if (league && league._count.teams >= league.maxTeams) {
        throw new BadRequestException(`League is full (${league.maxTeams}/${league.maxTeams} teams). Cannot approve more.`);
      }
    }

    return this.prisma.team.update({
      where: { id },
      data: { status: status as any },
    });
  }

async joinLeague(teamId: string, leagueId: string, user: any) {
    const team = await this.checkOwnership(teamId, user);
    
    if (team.leagueId === leagueId && team.status !== TeamStatus.REJECTED) {
      throw new BadRequestException('Team is already in this league.');
    }
    if (team.leagueId && team.leagueId !== leagueId) {
      if (team.status !== TeamStatus.REJECTED && team.league?.status !== LeagueStatus.COMPLETED) {
        throw new BadRequestException('Cannot join a new league while currently registered or competing in another active league.');
      }
    }

    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) throw new NotFoundException('League not found');

    if (league.status !== LeagueStatus.REGISTRATION) {
      throw new BadRequestException('League is not accepting new registrations currently.');
    }
    const now = new Date();
    if (now < league.registrationStart || now > league.registrationEnd) {
      throw new BadRequestException('Team registration window is closed for this league.');
    }

    if (team.players.length < league.minPlayers) {
      const shortage = league.minPlayers - team.players.length;
      throw new BadRequestException(`Cannot join: You need at least ${shortage} more players to meet the league's minimum requirement of ${league.minPlayers} players.`);
    }

    return this.prisma.team.update({
      where: { id: teamId },
      data: { leagueId, status: TeamStatus.PENDING },
    });
  }

  async removeFromLeague(id: string) {
    const team = await this.findOne(id);
    if (!team.leagueId) {
      throw new BadRequestException('Team is not in any league.');
    }

    if (team.league?.status === LeagueStatus.ONGOING) {
      throw new BadRequestException('Cannot remove team from an ongoing league.');
    }

    return this.prisma.team.update({
      where: { id },
      data: { 
        leagueId: null, 
        status: TeamStatus.PENDING 
      },
    });
  }
}
