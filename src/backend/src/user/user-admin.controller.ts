import { Controller, Get, Patch, Body, Param, ParseIntPipe, UseGuards, Request, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { UserAuditLog } from './entities/user-log.entity';

@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UserAdminController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async getAllUsers() {
    try {
      console.log('[GET /api/users] Fetching users list...');
      const userRepo = this.dataSource.getRepository(User);
      const users = await userRepo.find({
        relations: ['roles'],
        order: { userID: 'ASC' }
      });
      console.log(`[GET /api/users] Found ${users.length} users in DB`);

      const logRepo = this.dataSource.getRepository(UserAuditLog);
      const result = await Promise.all(
        users.map(async (user) => {
          const logs = await logRepo.find({
            where: { user: { userID: user.userID } },
            order: { createdAt: 'DESC' },
            take: 10
          });
          return {
            ...user,
            auditLogs: logs
          };
        })
      );
      console.log(`[GET /api/users] Succeeded, returning ${result.length} user records`);
      return result;
    } catch (err) {
      console.error('[GET /api/users] Failed with error:', err);
      throw err;
    }
  }

  @Patch(':userId/status')
  async toggleStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { status: string },
    @Request() req: any
  ) {
    const status = body.status;
    if (status !== 'ACTIVE' && status !== 'DEACTIVATED') {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }

    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await userRepo.findOne({ where: { userID: userId }, relations: ['roles'] });

      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      const oldStatus = user.status;
      user.status = status;
      await userRepo.save(user);

      const logRepo = manager.getRepository(UserAuditLog);
      const log = logRepo.create({
        action: 'TOGGLE_STATUS',
        description: `Thay đổi trạng thái tài khoản từ [${oldStatus}] thành [${status}]`,
        performedBy: req.user.email,
        user,
      });
      await logRepo.save(log);

      return user;
    });
  }

  @Patch(':userId/roles')
  async updateRoles(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { roles: string[] },
    @Request() req: any
  ) {
    const roleNames = body.roles;
    if (!Array.isArray(roleNames) || roleNames.length === 0) {
      throw new BadRequestException('Danh sách vai trò không được trống');
    }

    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const roleRepo = manager.getRepository(Role);

      const user = await userRepo.findOne({ where: { userID: userId }, relations: ['roles'] });
      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      const roles: Role[] = [];
      for (const name of roleNames) {
        const role = await roleRepo.findOne({ where: { name } });
        if (!role) {
          throw new BadRequestException(`Vai trò [${name}] không hợp lệ`);
        }
        roles.push(role);
      }

      const oldRoles = user.roles.map(r => r.name).join(', ');
      const newRolesStr = roleNames.join(', ');
      
      user.roles = roles;
      await userRepo.save(user);

      const logRepo = manager.getRepository(UserAuditLog);
      const log = logRepo.create({
        action: 'UPDATE_ROLES',
        description: `Cập nhật vai trò từ [${oldRoles}] thành [${newRolesStr}]`,
        performedBy: req.user.email,
        user,
      });
      await logRepo.save(log);

      return user;
    });
  }
}
