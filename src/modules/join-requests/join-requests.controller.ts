import { Controller, Get, Post, Body, Patch, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JoinRequestsService } from './join-requests.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Join Requests')
@Controller({ path: 'join-requests', version: '1' })
export class JoinRequestsController {
  constructor(private readonly jrService: JoinRequestsService) {}

  @Post()
  @Roles(UserRole.PLAYER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Send a join request to a team' })
  create(
    @Body('teamId', ParseUUIDPipe) teamId: string,
    @Body('message') message: string,
    @CurrentUser() user: any,
  ) {
    return this.jrService.create(user.sub, teamId, message);
  }

  @Get('me')
  @Roles(UserRole.PLAYER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get own join requests' })
  findMyRequests(@CurrentUser() user: any) {
    return this.jrService.findMyRequests(user.sub);
  }

  @Get('team/:teamId')
  @Roles(UserRole.MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get pending requests for a team' })
  findTeamRequests(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: any,
  ) {
    return this.jrService.findTeamRequests(user.sub, teamId);
  }

  @Patch(':id/approve')
  @Roles(UserRole.MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Approve a join request' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('number') number: number,
    @CurrentUser() user: any,
  ) {
    return this.jrService.updateStatus(user.sub, id, 'APPROVE', number);
  }

  @Patch(':id/reject')
  @Roles(UserRole.MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Reject a join request' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.jrService.updateStatus(user.sub, id, 'REJECT');
  }
}
