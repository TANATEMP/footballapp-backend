import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { MatchStatus, EventType, Match } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Redis } from 'ioredis';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchEventDto } from './dto/match-event.dto';
import { MatchQueryDto } from './dto/match-query.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class MatchesService {
  constructor(
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async create(dto: CreateMatchDto) {
    return this.prisma.match.create({
      data: {
        leagueId: dto.leagueId,
        homeTeamId: dto.homeTeamId,
        awayTeamId: dto.awayTeamId,
        matchDate: new Date(dto.scheduledAt),
        status: dto.status || MatchStatus.SCHEDULED,
        homeScore: dto.homeScore || 0,
        awayScore: dto.awayScore || 0,
      },
    });
  }

  async findAll(dto: MatchQueryDto, leagueId?: string) {
    const { status, teamId, sort = 'asc', page = 1, limit = 10 } = dto;
    const where: any = {};
    if (leagueId) where.leagueId = leagueId;
    if (status) where.status = status;
    if (teamId) {
      where.OR = [
        { homeTeamId: teamId },
        { awayTeamId: teamId }
      ];
    }

    const skip = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      this.prisma.match.findMany({
        where,
        skip,
        take: limit,
        include: {
          league: { select: { name: true } },
          homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
          awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
          events: {
            include: {
              player: { select: { id: true, name: true } },
              team: { select: { id: true, shortName: true } },
            },
            orderBy: { minute: 'asc' },
          },
        },
        orderBy: { matchDate: sort },
      }),
      this.prisma.match.count({ where }),
    ]);

    return buildPaginatedResponse(rows, count, dto);
  }

  async update(id: string, dto: UpdateMatchDto | any) {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException('Match not found');

    const previousStatus = match.status;
    const { scheduledAt, status, homeScore, awayScore} = dto;
    const isScoreUpdate = homeScore !== undefined || awayScore !== undefined || status === MatchStatus.COMPLETED;

    if (previousStatus === MatchStatus.DRAFT && isScoreUpdate) {
      throw new Error('Cannot report score for a DRAFT match. Please start the season first.');
    }

    const updateData: any = {};
    if (scheduledAt) updateData.matchDate = new Date(scheduledAt);
    if (status) updateData.status = status;
    if (homeScore !== undefined ) updateData.homeScore = homeScore;
    if (awayScore !== undefined ) updateData.awayScore = awayScore;

    const updatedMatch = await this.prisma.match.update({
      where: { id },
      data: updateData,
    });

    if (updatedMatch.status === MatchStatus.COMPLETED || previousStatus === MatchStatus.COMPLETED) {
      await this.syncLeagueStandings(match, updatedMatch);
    }

    await this.redis.publish(`match:${id}`, JSON.stringify({
      type: 'update',
      match: {
        id: updatedMatch.id,
        homeScore: updatedMatch.homeScore,
        awayScore: updatedMatch.awayScore,
        status: updatedMatch.status,
      },
    }));

    return updatedMatch;
  }

  async addEvent(matchId: string, dto: MatchEventDto | any) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');

    const type = dto.type || dto.eventType;
    const teamId = dto.teamId

    const event = await this.prisma.matchEvent.create({
      data: {
        matchId,
        teamId,
        playerId: dto.playerId || null,
        eventType: type,
        minute: dto.minute,
        commentary: dto.commentary,
      },
    });

    if (type === EventType.GOAL || type === EventType.OWN_GOAL) {
      let homeScoreInc = 0;
      let awayScoreInc = 0;

      if (type === EventType.GOAL) {
        if (teamId === match.homeTeamId) homeScoreInc = 1;
        if (teamId === match.awayTeamId) awayScoreInc = 1;
      } else { 
        if (teamId === match.homeTeamId) awayScoreInc = 1;
        if (teamId === match.awayTeamId) homeScoreInc = 1;
      }

      const updatedMatch = await this.prisma.match.update({
        where: { id: matchId },
        data: {
          homeScore: { increment: homeScoreInc },
          awayScore: { increment: awayScoreInc },
        },
      });

      await this.redis.publish(`match:${matchId}`, JSON.stringify({
        type: 'goal',
        event,
        match: {
          homeScore: updatedMatch.homeScore,
          awayScore: updatedMatch.awayScore,
        },
      }));
    }

    if (dto.playerId) {
      if ([EventType.GOAL, EventType.ASSIST, EventType.YELLOW_CARD, EventType.RED_CARD].includes(type)) {
        await this.updatePlayerStats(match.leagueId, dto.playerId, type);
      }
    }

    return event;
  }


  private async updatePlayerStats(leagueId: string, playerId: string, type: EventType) {
    const fieldMap: Partial<Record<EventType, string>> = {
      [EventType.GOAL]: 'goals',
      [EventType.ASSIST]: 'assists',
      [EventType.YELLOW_CARD]: 'yellowCards',
      [EventType.RED_CARD]: 'redCards',
    };

    const field = fieldMap[type];
    if (!field) return;

    const stat = await this.prisma.playerStat.findFirst({
      where: { leagueId, playerId },
    });

    if (stat) {
      await this.prisma.playerStat.update({
        where: { id: stat.id },
        data: { [field]: { increment: 1 } },
      });
    } else {
      await this.prisma.playerStat.create({
        data: {
          leagueId,
          playerId,
          [field]: 1,
        },
      });
    }
  }

  private async syncLeagueStandings(oldMatch: Match | null, newMatch: Match) {
    const { leagueId, homeTeamId, awayTeamId } = newMatch;
    if (!leagueId) return;

    const getStats = (m: Match | null) => {
      if (!m || m.status !== MatchStatus.COMPLETED) return null;
      const hWin = m.homeScore > m.awayScore;
      const draw = m.homeScore === m.awayScore;
      const aWin = m.homeScore < m.awayScore;
      return {
        home: {
          played: 1,
          won: hWin ? 1 : 0,
          drawn: draw ? 1 : 0,
          lost: aWin ? 1 : 0,
          gf: m.homeScore,
          ga: m.awayScore,
          pts: hWin ? 3 : draw ? 1 : 0
        },
        away: {
          played: 1,
          won: aWin ? 1 : 0,
          drawn: draw ? 1 : 0,
          lost: hWin ? 1 : 0,
          gf: m.awayScore,
          ga: m.homeScore,
          pts: aWin ? 3 : draw ? 1 : 0
        }
      };
    };

    const oldStats = getStats(oldMatch);
    const newStats = getStats(newMatch);

    const updateTeam = async (teamId: string, oldT: any, newT: any) => {
      const delta = {
        played: (newT?.played || 0) - (oldT?.played || 0),
        won: (newT?.won || 0) - (oldT?.won || 0),
        drawn: (newT?.drawn || 0) - (oldT?.drawn || 0),
        lost: (newT?.lost || 0) - (oldT?.lost || 0),
        gf: (newT?.gf || 0) - (oldT?.gf || 0),
        ga: (newT?.ga || 0) - (oldT?.ga || 0),
        pts: (newT?.pts || 0) - (oldT?.pts || 0)
      };

      if (Object.values(delta).every(v => v === 0)) return;

      const standing = await this.prisma.leagueStanding.findFirst({
        where: { leagueId, teamId },
      });

      if (standing) {
        await this.prisma.leagueStanding.update({
          where: { id: standing.id },
          data: {
            played: { increment: delta.played },
            won: { increment: delta.won },
            drawn: { increment: delta.drawn },
            lost: { increment: delta.lost },
            goalsFor: { increment: delta.gf },
            goalsAgainst: { increment: delta.ga },
            goalDifference: { increment: delta.gf - delta.ga },
            points: { increment: delta.pts },
          },
        });
      } else if (newT) {
        await this.prisma.leagueStanding.create({
          data: {
            leagueId,
            teamId,
            played: newT.played,
            won: newT.won,
            drawn: newT.drawn,
            lost: newT.lost,
            goalsFor: newT.gf,
            goalsAgainst: newT.ga,
            goalDifference: newT.gf - newT.ga,
            points: newT.pts,
          },
        });
      }
    };

    await updateTeam(homeTeamId, oldStats?.home, newStats?.home);
    await updateTeam(awayTeamId, oldStats?.away, newStats?.away);
  }

  getLiveScoreStream(matchId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      let redisSubscriber: Redis;

      const setup = async () => {
        const match = await this.prisma.match.findUnique({
          where: { id: matchId },
          select: { 
            id: true, status: true, homeScore: true, awayScore: true, 
            homeTeam: { select: { name: true } }, 
            awayTeam: { select: { name: true } } 
          },
        });

        if (!match) {
          subscriber.error(new NotFoundException('Match not found'));
          return;
        }

        subscriber.next({
          data: JSON.stringify({ type: 'init', match }),
          event: 'connected',
        } as MessageEvent);

        redisSubscriber = this.redis.duplicate();
        await redisSubscriber.subscribe(`match:${matchId}`);

        redisSubscriber.on('message', (channel: string, message: string) => {
          subscriber.next({
            data: message,
            event: 'score_update',
          } as MessageEvent);
        });

        const heartbeatInterval = setInterval(() => {
          subscriber.next({
            data: JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }),
            event: 'heartbeat',
          } as MessageEvent);
        }, 30000);

        return () => {
          clearInterval(heartbeatInterval);
          redisSubscriber?.unsubscribe(`match:${matchId}`);
          redisSubscriber?.disconnect();
        };
      };

      let cleanup: (() => void) | undefined;
      setup().then((fn) => { cleanup = fn; });

      return () => { cleanup?.(); };
    });
  }
}
