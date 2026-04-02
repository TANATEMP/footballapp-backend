import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';


@ApiTags('User')
@ApiBearerAuth('JWT-auth')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all users' })
  findAll() {
    return this.userService.findAll();
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Toggle user ban status (Admin only)' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string
  ) {
    return this.userService.updateStatus(id, status);
  }
}
