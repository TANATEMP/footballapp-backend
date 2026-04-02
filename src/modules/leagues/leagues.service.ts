// src/modules/leagues/leagues.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { LeagueStatus, MatchStatus, TeamStatus } from '@prisma/client';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
import { LeagueQueryDto } from './dto/league-query.dto';
import { GenerateFixturesDto } from './dto/generate-fixtures.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class LeaguesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLeagueDto, userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(dto.start_date);
    const end = new Date(dto.end_date);
    const regEnd = dto.registrationEnd ? new Date(dto.registrationEnd) : new Date(dto.start_date);

    if (start < today) {
      throw new Error('Tournament start date cannot be in the past.');
    }
    if (end <= start) {
      throw new Error('Tournament end date must be after the start date.');
    }
    if (regEnd < today) {
      throw new Error('Registration deadline cannot be in the past.');
    }

    return this.prisma.league.create({
      data: {
        name: dto.name,
        season: dto.season,
        description: dto.description,
        startDate: new Date(dto.start_date),
        endDate: new Date(dto.end_date),
        status: dto.status,
        maxTeams: dto.maxTeams ?? 20,
        minPlayers: dto.minPlayers ?? 11,
        maxPlayers: dto.maxPlayers ?? 25,
        registrationStart: dto.registrationStart ? new Date(dto.registrationStart) : new Date(),
        registrationEnd: dto.registrationEnd ? new Date(dto.registrationEnd) : new Date(dto.start_date),
        daysOfWeek: dto.daysOfWeek ?? [6, 0],
        startTime: dto.startTime ?? '18:00',
        endTime: dto.endTime ?? '22:00',
        matchDuration: dto.matchDuration ?? 120,
        matchFormat: dto.matchFormat ?? 'SINGLE',
        creator: { connect: { id: userId } },
      },
    });
  }

  async findAll(dto: LeagueQueryDto) {
    const { status, page = 1, limit = 10 } = dto;
    const where = status ? { status } : {};
    const skip = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      this.prisma.league.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: { select: { id: true, name: true } },
          _count: { 
            select: { 
              teams: true, // Total Applicants (PENDING + APPROVED)
              matches: true // Total Matches
            } 
          },
          teams: {
            where: { status: TeamStatus.APPROVED },
            select: { id: true } 
          },
          matches: {
            where: { status: MatchStatus.COMPLETED },
            select: { id: true }
          }
        },
      }),
      this.prisma.league.count({ where }),
    ]);

    const mappedRows = rows.map(l => ({
      ...l,
      totalApplicants: l._count.teams,
      approvedTeamsCount: l.teams.length,
      totalMatches: l._count.matches,
      completedMatches: l.matches.length,
      teams: undefined,
      matches: undefined
    }));

    return buildPaginatedResponse(mappedRows, count, dto);
  }

  async findOne(id: string) {
    const league = await this.prisma.league.findUnique({
      where: { id },
      include: { 
        creator: true, 
        _count: {
          select: {
            teams: true, // Total Applicants
            matches: true // Total Matches
          }
        },
        teams: {
          where: { status: TeamStatus.APPROVED }
        },
        matches: {
          where: { status: MatchStatus.COMPLETED },
          select: { id: true }
        }
      },
    });
    if (!league) throw new NotFoundException('League not found');

    return {
      ...league,
      totalApplicants: league._count.teams,
      approvedTeamsCount: league.teams.length,
      totalMatches: league._count.matches,
      completedMatches: league.matches.length
    };
  }

  async update(id: string, dto: UpdateLeagueDto) {
    await this.findOne(id); // verify existence
    return this.prisma.league.update({
      where: { id },
      data: dto as any,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.league.delete({ where: { id } });
    return { success: true };
  }

  async updateStatus(id: string, newStatus: LeagueStatus) {
    await this.findOne(id);
    return this.prisma.league.update({
      where: { id },
      data: { status: newStatus },
    });
  }

  async startSeason(id: string) {
    const league = await this.findOne(id);
    if (league.status !== LeagueStatus.PRE_SEASON) {
      throw new Error('League must be in PRE_SEASON to start.');
    }

    // ตรวจสอบว่ามี DRAFT matches อยู่ก่อน (ต้อง Generate Fixtures แล้ว)
    const draftCount = await this.prisma.match.count({
      where: { leagueId: id, status: MatchStatus.DRAFT },
    });
    if (draftCount === 0) {
      throw new Error('No fixtures found. Please generate fixtures before starting the season.');
    }

    // 1. Update all DRAFT matches to SCHEDULED
    await this.prisma.match.updateMany({
      where: { leagueId: id, status: MatchStatus.DRAFT },
      data: { status: MatchStatus.SCHEDULED },
    });

    // 2. Initialize Standings for all approved teams (0 points start)
    const approvedTeams = await this.prisma.team.findMany({
      where: {
        leagueId: id,
        status: TeamStatus.APPROVED,
      },
    });

    for (const team of approvedTeams) {
      const existing = await this.prisma.leagueStanding.findFirst({
        where: { leagueId: id, teamId: team.id },
      });
      if (!existing) {
        await this.prisma.leagueStanding.create({
          data: {
            leagueId: id,
            teamId: team.id,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0,
          },
        });
      }
    }

    // 3. Change League status to ONGOING
    return this.prisma.league.update({
      where: { id },
      data: { status: LeagueStatus.ONGOING },
    });
  }

  async generateFixtures(id: string, dto: GenerateFixturesDto = {}) {
    const league = await this.findOne(id);
    if (league.status !== LeagueStatus.PRE_SEASON) {
      throw new Error('League must be in PRE_SEASON to generate fixtures.');
    }

    const teams = await this.prisma.team.findMany({
      where: { leagueId: id, status: TeamStatus.APPROVED },
    });

    if (teams.length < 2) {
      throw new Error('Not enough approved teams to generate fixtures.');
    }

    await this.prisma.match.deleteMany({
      where: { leagueId: id, status: { in: [MatchStatus.DRAFT, MatchStatus.SCHEDULED] } },
    });

    // --- Smart Scheduling Parameters (Prefer stored defaults, fallback to DTO) ---
    const allowedDays = dto.daysOfWeek?.length ? dto.daysOfWeek : (league.daysOfWeek?.length ? league.daysOfWeek : [6, 0]);
    const startTimeStr = dto.startTime || league.startTime || '18:00';
    const endTimeStr = dto.endTime || league.endTime || '22:00';
    const durationMins = dto.matchDuration || league.matchDuration || 120;
    const format = dto.matchFormat || league.matchFormat || 'SINGLE';

    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);
    const durationMs = durationMins * 60000;

    const teamIds = teams.map(t => t.id);
    if (teamIds.length % 2 !== 0) teamIds.push('BYE');

    let numRounds = teamIds.length - 1;
    if (format === 'DOUBLE') numRounds *= 2; // Support Double Round-Robin

    const matchesPerRound = teamIds.length / 2;
    const matchesToCreate: any[] = [];
    const allowOverlap = true; // Always allow overlap for now as per previous requirement

    let roundStartDate = new Date(league.startDate);
    // Adjust for Thai Timezone (GMT+7) when setting hours from user input
    // 18:00 Local (Thai) = 11:00 UTC
    roundStartDate.setUTCHours(startH - 7, startM, 0, 0);

    // Initial jump to first allowed day
    while (!allowedDays.includes(roundStartDate.getDay())) {
      roundStartDate.setDate(roundStartDate.getDate() + 1);
    }

    for (let round = 0; round < numRounds; round++) {
      let currentMatchTime = new Date(roundStartDate);
      const dayEnd = new Date(roundStartDate);
      // Adjust for Thai Timezone (GMT+7) when setting end hours
      dayEnd.setUTCHours(endH - 7, endM, 0, 0);

      for (let match = 0; match < matchesPerRound; match++) {
        const homeId = teamIds[match];
        const awayId = teamIds[teamIds.length - 1 - match];

        if (homeId !== 'BYE' && awayId !== 'BYE') {
          // Check if this match fits sequentially
          if (currentMatchTime.getTime() + durationMs > dayEnd.getTime() + 60000) {
            // Default: Start at the beginning of the same day (Overlap)
            currentMatchTime = new Date(roundStartDate);
          }

          matchesToCreate.push({
            leagueId: id,
            homeTeamId: homeId,
            awayTeamId: awayId,
            matchDate: new Date(currentMatchTime),
            status: MatchStatus.DRAFT,
          });

          // Prep for next match in round
          currentMatchTime.setTime(currentMatchTime.getTime() + durationMs);
        }
      }

      // Rotate teams
      const lastTeam = teamIds.pop();
      teamIds.splice(1, 0, lastTeam!);
      
      // Move to the next available day for the NEXT round
      do {
        roundStartDate.setDate(roundStartDate.getDate() + 1);
        roundStartDate.setUTCHours(startH - 7, startM, 0, 0);
      } while (!allowedDays.includes(roundStartDate.getDay()));
    }

    await this.prisma.match.createMany({ data: matchesToCreate });
    return { success: true, count: matchesToCreate.length };
  }

  async getStandings(leagueId: string) {
    await this.findOne(leagueId);
    return this.prisma.leagueStanding.findMany({
      where: { leagueId },
      include: { team: { select: { name: true, logoUrl: true } } },
      orderBy: [
        { points: 'desc' },
        { goalDifference: 'desc' },
        { goalsFor: 'desc' },
      ],
    });
  }

  async getTopScorers(leagueId: string) {
    await this.findOne(leagueId);
    return this.prisma.playerStat.findMany({
      where: { leagueId },
      include: {
        player: {
          select: {
            name: true,
            team: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { goals: 'desc' },
        { assists: 'desc' },
      ],
      take: 20,
    });
  }
}
