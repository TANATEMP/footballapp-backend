// src/modules/leagues/leagues.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
import { LeagueQueryDto } from './dto/league-query.dto';
import { UpdateLeagueStatusDto } from './dto/update-league-status.dto';
import { GenerateFixturesDto } from './dto/generate-fixtures.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Leagues')
@Controller({ path: 'leagues', version: '1' })
export class LeaguesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create new league', description: 'Admin only' })
  @ApiResponse({ status: 201, description: 'League created' })
  create(@Body() createLeagueDto: CreateLeagueDto, @CurrentUser() user: any) {
    return this.leaguesService.create(createLeagueDto, user.sub);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all leagues', description: 'Public endpoint' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: UserRole }) // Swagger can't see the internal enum directly here easily, but let's keep it consistent
  findAll(@Query() query: LeagueQueryDto) {
    return this.leaguesService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get league details' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaguesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update league', description: 'Admin only' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateLeagueDto: UpdateLeagueDto) {
    return this.leaguesService.update(id, updateLeagueDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete league', description: 'Admin only' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaguesService.remove(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update league status (e.g. to PRE_SEASON)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeagueStatusDto,
  ) {
    return this.leaguesService.updateStatus(id, dto.status);
  }

  @Post(':id/start-season')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Start the season (publish matches, change to ONGOING)' })
  startSeason(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaguesService.startSeason(id);
  }

  @Post(':id/generate-fixtures')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Auto-generate matches (only in PRE_SEASON)' })
  generateFixtures(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateFixturesDto,
  ) {
    return this.leaguesService.generateFixtures(id, dto);
  }

  @Get(':id/standings')
  @Public()
  @ApiOperation({ summary: 'Get league table / standings' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getStandings(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaguesService.getStandings(id);
  }

  @Get(':id/top-scorers')
  @Public()
  @ApiOperation({ summary: 'Get league top scorers' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getTopScorers(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaguesService.getTopScorers(id);
  }
}
