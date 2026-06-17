import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards, Request, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
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

  @Post()
  async createUser(
    @Body() body: { email: string; fullName: string; phoneNumber?: string; password: string; roles: string[] },
    @Request() req: any,
  ) {
    const { email, fullName, phoneNumber, password, roles: roleNames } = body;
    if (!email || !fullName || !password || !Array.isArray(roleNames) || roleNames.length === 0) {
      throw new BadRequestException('email, fullName, password, and roles are required');
    }

    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const roleRepo = manager.getRepository(Role);

      const existing = await userRepo.findOne({ where: { email } });
      if (existing) {
        throw new BadRequestException(`User with email [${email}] already exists`);
      }

      const roles: Role[] = [];
      for (const name of roleNames) {
        const role = await roleRepo.findOne({ where: { name } });
        if (!role) {
          throw new BadRequestException(`Role [${name}] does not exist`);
        }
        roles.push(role);
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = userRepo.create({ email, fullName, phoneNumber, passwordHash, roles, status: 'ACTIVE' });
      const savedUser = await userRepo.save(user);

      const logRepo = manager.getRepository(UserAuditLog);
      await logRepo.save(logRepo.create({
        action: 'CREATE_USER',
        description: `Tạo tài khoản mới cho [${email}] với vai trò [${roleNames.join(', ')}]`,
        performedBy: req.user.email,
        user: savedUser,
      }));

      return savedUser;
    });
  }

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

  @Patch(':userId')
  async updateUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { email?: string; fullName?: string; phoneNumber?: string },
    @Request() req: any,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await userRepo.findOne({ where: { userID: userId }, relations: ['roles'] });
      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      if (body.email !== undefined) user.email = body.email;
      if (body.fullName !== undefined) user.fullName = body.fullName;
      if (body.phoneNumber !== undefined) user.phoneNumber = body.phoneNumber;

      await userRepo.save(user);

      const logRepo = manager.getRepository(UserAuditLog);
      await logRepo.save(logRepo.create({
        action: 'UPDATE_USER',
        description: `Cập nhật thông tin tài khoản user ID [${userId}]`,
        performedBy: req.user.email,
        user,
      }));

      return user;
    });
  }

  @Patch(':userId/status')
  async toggleStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { status: string },
    @Request() req: any
  ) {
    const status = body.status;
    const resolvedStatus = status === 'UNBLOCKED' ? 'ACTIVE' : status;
    if (resolvedStatus !== 'ACTIVE' && resolvedStatus !== 'DEACTIVATED' && status !== 'BLOCKED') {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }
    const finalStatus = status === 'BLOCKED' ? 'DEACTIVATED' : resolvedStatus;

    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await userRepo.findOne({ where: { userID: userId }, relations: ['roles'] });

      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      const oldStatus = user.status;
      user.status = finalStatus;
      await userRepo.save(user);

      const logRepo = manager.getRepository(UserAuditLog);
      const log = logRepo.create({
        action: 'TOGGLE_STATUS',
        description: `Thay đổi trạng thái tài khoản từ [${oldStatus}] thành [${finalStatus}] (input: ${status})`,
        performedBy: req.user.email,
        user,
      });
      await logRepo.save(log);

      return user;
    });
  }

  @Post(':userId/reset-password')
  async resetPassword(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let temporaryPassword = '';
    for (let i = 0; i < 12; i++) {
      temporaryPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await userRepo.findOne({ where: { userID: userId }, relations: ['roles'] });
      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      await userRepo.update(userId, { passwordHash } as any);

      const logRepo = manager.getRepository(UserAuditLog);
      await logRepo.save(logRepo.create({
        action: 'RESET_PASSWORD',
        description: `Đặt lại mật khẩu tạm thời cho user ID [${userId}]`,
        performedBy: req.user.email,
        user,
      }));
    });

    return { temporaryPassword };
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
