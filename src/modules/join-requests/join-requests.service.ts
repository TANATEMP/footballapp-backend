import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { JoinRequestStatus, UserRole } from '@prisma/client';
import { PlayersService } from '../players/players.service';

@Injectable()
export class JoinRequestsService {
  constructor(
    private prisma: PrismaService,
    private playersService: PlayersService,
  ) {}

  async create(userId: string, teamId: string, message?: string) {
    // 1. Check if user already has an active player profile WITH A TEAM
    const existingPlayer = await this.prisma.player.findFirst({
      where: { userId },
    });
    if (existingPlayer && existingPlayer.teamId) {
      throw new BadRequestException('You are already signed to a team. Cannot join another.');
    }

    // 2. Check for duplicate pending requests
    const existingReq = await this.prisma.joinRequest.findUnique({
      where: {
        userId_teamId_status: {
          userId,
          teamId,
          status: 'PENDING',
        },
      },
    });

    if (existingReq) {
      throw new ConflictException('You already have a pending join request for this team.');
    }

    return this.prisma.joinRequest.create({
      data: {
        userId,
        teamId,
        message,
        status: JoinRequestStatus.PENDING,
      },
    });
  }

  async findMyRequests(userId: string) {
    return this.prisma.joinRequest.findMany({
      where: { userId },
      include: { team: { select: { id: true, name: true, logoUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findTeamRequests(managerUserId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.managerId !== managerUserId) throw new ForbiddenException('You do not manage this team.');

    return this.prisma.joinRequest.findMany({
      where: { teamId, status: JoinRequestStatus.PENDING },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(managerUserId: string, requestId: string, action: 'APPROVE' | 'REJECT', number?: number) {
    const request = await this.prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { team: true, user: true },
    });

    if (!request) throw new NotFoundException('Join request not found');
    if (request.team.managerId !== managerUserId) {
      throw new ForbiddenException('You do not have permission to manage this team\'s requests.');
    }
    if (request.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('This request has already been processed.');
    }

    if (action === 'REJECT') {
      return this.prisma.joinRequest.update({
        where: { id: requestId },
        data: { status: JoinRequestStatus.REJECTED },
      });
    }

    // APPROVE
    return this.prisma.$transaction(async (tx) => {
      // 1. Check if team has reached max players
      if (request.team.leagueId) {
        const league = await tx.league.findUnique({ where: { id: request.team.leagueId } });
        if (league) {
          const playerCount = await tx.player.count({ where: { teamId: request.teamId } });
          if (playerCount >= league.maxPlayers) {
            throw new BadRequestException(`Cannot approve: Team has reached the league maximum of ${league.maxPlayers} players.`);
          }
        }
      }

      const currentPlayer = await tx.player.findUnique({
        where: { userId: request.userId },
      });

      if (number) {
        await this.playersService.validateJerseyNumber(request.teamId, number);
      }

      await tx.joinRequest.deleteMany({
        where: {
          userId: request.userId,
          teamId: request.teamId,
          id: { not: requestId },
        },
      });

      if (currentPlayer) {
        await tx.player.update({
          where: { id: currentPlayer.id },
          data: { 
            teamId: request.teamId,
            number: number || currentPlayer.number,
          },
        });
      } else {
        await tx.player.create({
          data: {
            name: request.user.name,
            position: 'MID',
            teamId: request.teamId,
            userId: request.userId,
            number: number || null,
          },
        });
      }

      return tx.joinRequest.update({
        where: { id: requestId },
        data: { status: JoinRequestStatus.APPROVED },
      });
    });
  }
}
