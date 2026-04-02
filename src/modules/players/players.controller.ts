// src/modules/players/players.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { PlayersService } from './players.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PlayerQueryDto } from './dto/player-query.dto';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Players')
@Controller({ path: 'players', version: '1' })
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all players', description: 'Public endpoint' })
  @ApiQuery({ name: 'teamId', required: false, type: String })
  findAll(@Query() query: PlayerQueryDto) {
    return this.playersService.findAll(query, query.teamId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.PLAYER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create new player', description: 'Admin, Manager, or Player' })
  create(@Body() dto: CreatePlayerDto, @CurrentUser() user: any) {
    return this.playersService.create(dto, user.sub);
  }

  @Get('me')
  @Roles(UserRole.PLAYER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get own player profile' })
  findMe(@CurrentUser() user: any) {
    return this.playersService.findMe(user.sub);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get player details' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.playersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.PLAYER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update player details' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlayerDto, @CurrentUser() user: any) {
    return this.playersService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete player' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.playersService.remove(id);
  }
}
