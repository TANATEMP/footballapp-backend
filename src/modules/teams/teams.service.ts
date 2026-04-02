// src/modules/teams/teams.service.ts
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
        leagueId: dto.leagueId || dto.league_id || null,
        managerId: dto.managerId || dto.manager_id || userId,
        logoUrl: dto.logoUrl || dto.logo_url || null,
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
    // This is a stub for Cloudinary/S3 integration
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
    if (data.league_id) data.leagueId = data.league_id;
    if (data.manager_id) data.managerId = data.manager_id;
    if (data.logo_url) data.logoUrl = data.logo_url;
    delete data.league_id;
    delete data.manager_id;
    delete data.logo_url;

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
    
    // If approving, check league capacity
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
    
    // 🛡️ Rule 0.1: ป้องกันการสมัครซ้ำลีกเดิม "ยกเว้น" ว่าจะเคยโดน Reject มาก่อน (ให้โอกาสแก้ตัว)
    if (team.leagueId === leagueId && team.status !== TeamStatus.REJECTED) {
      throw new BadRequestException('Team is already in this league.');
    }

    // 🛡️ Rule 0.2: ถ้ามีลีกอื่นอยู่แล้ว จะไปสมัครลีกใหม่ได้ ก็ต่อเมื่อ โดน Reject มา หรือ ลีกเก่าเตะจบ (COMPLETED) ไปแล้วเท่านั้น
    if (team.leagueId && team.leagueId !== leagueId) {
      if (team.status !== TeamStatus.REJECTED && team.league?.status !== LeagueStatus.COMPLETED) {
        throw new BadRequestException('Cannot join a new league while currently registered or competing in another active league.');
      }
    }

    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) throw new NotFoundException('League not found');

    // Rule 1: Status must be REGISTRATION
    if (league.status !== LeagueStatus.REGISTRATION) {
      throw new BadRequestException('League is not accepting new registrations currently.');
    }

    // Rule 2: Time-based Window
    const now = new Date();
    if (now < league.registrationStart || now > league.registrationEnd) {
      throw new BadRequestException('Team registration window is closed for this league.');
    }

    // Rule 3: minPlayers check
    if (team.players.length < league.minPlayers) {
      const shortage = league.minPlayers - team.players.length;
      throw new BadRequestException(`Cannot join: You need at least ${shortage} more players to meet the league's minimum requirement of ${league.minPlayers} players.`);
    }

    // All clear - join
    return this.prisma.team.update({
      where: { id: teamId },
      data: { leagueId, status: TeamStatus.PENDING }, // reset team status to pending for admin to approve
    });
  }

  async removeFromLeague(id: string) {
    const team = await this.findOne(id);
    if (!team.leagueId) {
      throw new BadRequestException('Team is not in any league.');
    }

    // Prevent removal if season is ONGOING
    if (team.league && team.league.status === LeagueStatus.ONGOING) {
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
