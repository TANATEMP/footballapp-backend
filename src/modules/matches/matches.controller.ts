import { Controller, Get, Post, Body, Patch, Param, Query, ParseUUIDPipe, Sse, MessageEvent, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { UpdateMatchScoreDto } from './dto/update-match-score.dto';
import { MatchEventDto } from './dto/match-event.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { MatchQueryDto } from './dto/match-query.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Matches')
@Controller({ path: 'matches', version: '1' })
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create new match', description: 'Admin only' })
  create(@Body() dto: CreateMatchDto) {
    return this.matchesService.create(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all matches', description: 'Public endpoint' })
  @ApiQuery({ name: 'leagueId', required: false, type: String })
  findAll(@Query() query: MatchQueryDto) {
    return this.matchesService.findAll(query, query.leagueId);
  }

  @Get(':id/live')
  @Public()
  @Sse()
  @ApiOperation({
    summary: 'Live score stream (SSE)',
    description: 'Server-Sent Events stream สำหรับ live score',
  })
  @ApiResponse({ status: 200, description: 'SSE stream started' })
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('X-Accel-Buffering', 'no')
  liveScore(@Param('id', ParseUUIDPipe) id: string): Observable<MessageEvent> {
    return this.matchesService.getLiveScoreStream(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update match details / scores' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMatchDto) {
    return this.matchesService.update(id, dto);
  }

  @Patch(':id/score')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Report match result (scores) and auto-update standings' })
  reportScore(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMatchScoreDto) {
    return this.matchesService.update(id, {
      homeScore: dto.homeScore,
      awayScore: dto.awayScore,
      status: dto.status || 'COMPLETED',
    });
  }

  @Post(':id/events')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Log match event (goal, card, etc.)' })
  addEvent(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MatchEventDto) {
    return this.matchesService.addEvent(id, dto);
  }
}
