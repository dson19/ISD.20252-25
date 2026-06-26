import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserAdminService } from './services/user-admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserInput } from './services/user-admin.service';

/**
 * Thin controller: only maps HTTP requests to UserAdminService calls.
 * All business logic (validation, hashing, persistence, audit logging) lives in the service.
 * ValidationPipe (whitelist) validates input ở biên qua các DTO, đồng nhất với module Product.
 */
@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class UserAdminController {
  constructor(private readonly userAdminService: UserAdminService) {}

  @Post()
  createUser(@Body() body: CreateUserDto, @Request() req: any) {
    return this.userAdminService.createUser(body, req.user.email);
  }

  @Get('logs')
  getUserLogs() {
    return this.userAdminService.getUserLogs();
  }

  @Get()
  getAllUsers() {
    return this.userAdminService.getAllUsers();
  }

  @Patch(':userId')
  updateUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: UpdateUserInput,
    @Request() req: any,
  ) {
    return this.userAdminService.updateUser(userId, body, req.user.email);
  }

  @Patch(':userId/status')
  toggleStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { status: string },
    @Request() req: any,
  ) {
    return this.userAdminService.toggleStatus(userId, body.status, req.user.email);
  }

  @Post(':userId/reset-password')
  resetPassword(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ) {
    return this.userAdminService.resetPassword(userId, req.user.email);
  }

  @Patch(':userId/roles')
  updateRoles(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { roles: string[] },
    @Request() req: any,
  ) {
    return this.userAdminService.updateRoles(userId, body.roles, req.user.email);
  }
}
