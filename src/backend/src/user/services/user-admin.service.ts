import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UserAuditLog } from '../entities/user-log.entity';
import { PASSWORD_HASHER } from '../interfaces/password-hasher.interface';
import type { IPasswordHasher } from '../interfaces/password-hasher.interface';

export interface CreateUserInput {
  email: string;
  fullName: string;
  phoneNumber?: string;
  password: string;
  roles: string[];
}

export interface UpdateUserInput {
  email?: string;
  fullName?: string;
  phoneNumber?: string;
}

/**
 * + Coupling/Cohesion level:
 *   - Data Coupling: Receives primitive/DTO inputs (email, status, roles) and an injected hasher abstraction.
 *   - Functional Cohesion: Every method is dedicated to one administrative concern — managing user accounts.
 * + SOLID Principles Review:
 *   - SRP Adherence: Holds the user-management business logic that used to be crammed into the controller.
 *   - DIP Adherence: Depends on IPasswordHasher (PASSWORD_HASHER token), not on the bcrypt library directly.
 *   - OCP Adherence: New account statuses are added via the statusMap, not by editing branching logic.
 */
@Injectable()
export class UserAdminService {
  private readonly logger = new Logger(UserAdminService.name);

  // Maps any accepted status input to the value actually stored in DB.
  private readonly statusMap: Record<string, string> = {
    ACTIVE: 'ACTIVE',
    DEACTIVATED: 'DEACTIVATED',
    UNBLOCKED: 'ACTIVE',
    BLOCKED: 'DEACTIVATED',
  };

  constructor(
    private readonly dataSource: DataSource,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
  ) {}

  async createUser(input: CreateUserInput, performedBy: string): Promise<User> {
    if (
      !input.email ||
      !input.fullName ||
      !input.password ||
      !Array.isArray(input.roles) ||
      input.roles.length === 0
    ) {
      throw new BadRequestException(
        'email, fullName, password, and roles are required',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);

      const existing = await userRepo.findOne({ where: { email: input.email } });
      if (existing) {
        throw new BadRequestException(
          `User with email [${input.email}] already exists`,
        );
      }

      const roles = await this.resolveRoles(manager, input.roles);
      const passwordHash = await this.passwordHasher.hash(input.password);

      const savedUser = await userRepo.save(
        userRepo.create({
          email: input.email,
          fullName: input.fullName,
          phoneNumber: input.phoneNumber,
          passwordHash,
          roles,
          status: 'ACTIVE',
        }),
      );

      await this.writeLog(manager, {
        action: 'CREATE_USER',
        description: `Tạo tài khoản mới cho [${input.email}] với vai trò [${input.roles.join(', ')}]`,
        performedBy,
        user: savedUser,
      });

      return savedUser;
    });
  }

  async getAllUsers() {
    this.logger.log('Fetching users list...');
    const userRepo = this.dataSource.getRepository(User);
    const users = await userRepo.find({
      relations: ['roles'],
      order: { userID: 'ASC' },
    });

    const logRepo = this.dataSource.getRepository(UserAuditLog);
    const result = await Promise.all(
      users.map(async (user) => {
        const logs = await logRepo.find({
          where: { user: { userID: user.userID } },
          order: { createdAt: 'DESC' },
          take: 10,
        });
        return { ...user, auditLogs: logs };
      }),
    );
    this.logger.log(`Returning ${result.length} user records`);
    return result;
  }

  async updateUser(
    userId: number,
    input: UpdateUserInput,
    performedBy: string,
  ): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await this.findUserOrFail(manager, userId);

      if (input.email !== undefined) user.email = input.email;
      if (input.fullName !== undefined) user.fullName = input.fullName;
      if (input.phoneNumber !== undefined) user.phoneNumber = input.phoneNumber;

      await userRepo.save(user);

      await this.writeLog(manager, {
        action: 'UPDATE_USER',
        description: `Cập nhật thông tin tài khoản user ID [${userId}]`,
        performedBy,
        user,
      });

      return user;
    });
  }

  async toggleStatus(
    userId: number,
    statusInput: string,
    performedBy: string,
  ): Promise<User> {
    const finalStatus = this.resolveStatus(statusInput);

    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await this.findUserOrFail(manager, userId);

      const oldStatus = user.status;
      user.status = finalStatus;
      await userRepo.save(user);

      await this.writeLog(manager, {
        action: 'TOGGLE_STATUS',
        description: `Thay đổi trạng thái tài khoản từ [${oldStatus}] thành [${finalStatus}] (input: ${statusInput})`,
        performedBy,
        user,
      });

      return user;
    });
  }

  async resetPassword(
    userId: number,
    performedBy: string,
  ): Promise<{ temporaryPassword: string }> {
    const temporaryPassword = this.passwordHasher.generateTemporaryPassword(12);
    const passwordHash = await this.passwordHasher.hash(temporaryPassword);

    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await this.findUserOrFail(manager, userId);

      await userRepo.update(userId, { passwordHash } as Partial<User>);

      await this.writeLog(manager, {
        action: 'RESET_PASSWORD',
        description: `Đặt lại mật khẩu tạm thời cho user ID [${userId}]`,
        performedBy,
        user,
      });
    });

    return { temporaryPassword };
  }

  async updateRoles(
    userId: number,
    roleNames: string[],
    performedBy: string,
  ): Promise<User> {
    if (!Array.isArray(roleNames) || roleNames.length === 0) {
      throw new BadRequestException('Danh sách vai trò không được trống');
    }

    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await this.findUserOrFail(manager, userId);

      const oldRoles = user.roles.map((r) => r.name).join(', ');
      user.roles = await this.resolveRoles(manager, roleNames);
      await userRepo.save(user);

      await this.writeLog(manager, {
        action: 'UPDATE_ROLES',
        description: `Cập nhật vai trò từ [${oldRoles}] thành [${roleNames.join(', ')}]`,
        performedBy,
        user,
      });

      return user;
    });
  }

  private resolveStatus(input: string): string {
    const finalStatus = this.statusMap[input];
    if (!finalStatus) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }
    return finalStatus;
  }

  private async resolveRoles(
    manager: EntityManager,
    roleNames: string[],
  ): Promise<Role[]> {
    const roleRepo = manager.getRepository(Role);
    const roles: Role[] = [];
    for (const name of roleNames) {
      const role = await roleRepo.findOne({ where: { name } });
      if (!role) {
        throw new BadRequestException(`Vai trò [${name}] không hợp lệ`);
      }
      roles.push(role);
    }
    return roles;
  }

  private async findUserOrFail(
    manager: EntityManager,
    userId: number,
  ): Promise<User> {
    const user = await manager.getRepository(User).findOne({
      where: { userID: userId },
      relations: ['roles'],
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return user;
  }

  private async writeLog(
    manager: EntityManager,
    params: {
      action: string;
      description: string;
      performedBy: string;
      user: User;
    },
  ): Promise<void> {
    const logRepo = manager.getRepository(UserAuditLog);
    await logRepo.save(logRepo.create(params));
  }
}
