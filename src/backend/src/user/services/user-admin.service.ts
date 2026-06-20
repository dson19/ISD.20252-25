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
import { UserRepository } from '../entities/user.repository';
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

  private readonly statusMap: Record<string, string> = {
    ACTIVE: 'ACTIVE',
    DEACTIVATED: 'DEACTIVATED',
    UNBLOCKED: 'ACTIVE',
    BLOCKED: 'DEACTIVATED',
  };

  constructor(
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
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
      throw new BadRequestException('email, fullName, password, and roles are required');
    }

    return this.dataSource.transaction(async (manager) => {
      const existing = await this.userRepository.findByEmailInTransaction(input.email, manager);
      if (existing) {
        throw new BadRequestException(`User with email [${input.email}] already exists`);
      }

      const roles = await this.resolveRoles(input.roles, manager);
      const passwordHash = await this.passwordHasher.hash(input.password);

      const newUser = manager.create(User, {
        email: input.email,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        passwordHash,
        roles,
        status: 'ACTIVE',
      });
      const savedUser = await this.userRepository.save(newUser, manager);

      await this.userRepository.saveAuditLog({
        action: 'CREATE_USER',
        description: `Tạo tài khoản mới cho [${input.email}] với vai trò [${input.roles.join(', ')}]`,
        performedBy,
        user: savedUser,
      }, manager);

      return savedUser;
    });
  }

  async getAllUsers() {
    this.logger.log('Fetching users list...');
    const users = await this.userRepository.findAll();

    const result = await Promise.all(
      users.map(async (user) => {
        const auditLogs = await this.userRepository.findAuditLogs(user.userID);
        return { ...user, auditLogs };
      }),
    );
    this.logger.log(`Returning ${result.length} user records`);
    return result;
  }

  async updateUser(userId: number, input: UpdateUserInput, performedBy: string): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.findUserOrFail(userId, manager);

      if (input.email !== undefined) user.email = input.email;
      if (input.fullName !== undefined) user.fullName = input.fullName;
      if (input.phoneNumber !== undefined) user.phoneNumber = input.phoneNumber;

      await this.userRepository.save(user, manager);

      await this.userRepository.saveAuditLog({
        action: 'UPDATE_USER',
        description: `Cập nhật thông tin tài khoản user ID [${userId}]`,
        performedBy,
        user,
      }, manager);

      return user;
    });
  }

  async toggleStatus(userId: number, statusInput: string, performedBy: string): Promise<User> {
    const finalStatus = this.resolveStatus(statusInput);

    return this.dataSource.transaction(async (manager) => {
      const user = await this.findUserOrFail(userId, manager);
      const oldStatus = user.status;
      user.status = finalStatus;
      await this.userRepository.save(user, manager);

      await this.userRepository.saveAuditLog({
        action: 'TOGGLE_STATUS',
        description: `Thay đổi trạng thái tài khoản từ [${oldStatus}] thành [${finalStatus}] (input: ${statusInput})`,
        performedBy,
        user,
      }, manager);

      return user;
    });
  }

  async resetPassword(userId: number, performedBy: string): Promise<{ temporaryPassword: string }> {
    const temporaryPassword = this.passwordHasher.generateTemporaryPassword(12);
    const passwordHash = await this.passwordHasher.hash(temporaryPassword);

    await this.dataSource.transaction(async (manager) => {
      const user = await this.findUserOrFail(userId, manager);
      await this.userRepository.updatePartial(userId, { passwordHash } as Partial<User>, manager);

      await this.userRepository.saveAuditLog({
        action: 'RESET_PASSWORD',
        description: `Đặt lại mật khẩu tạm thời cho user ID [${userId}]`,
        performedBy,
        user,
      }, manager);
    });

    return { temporaryPassword };
  }

  async updateRoles(userId: number, roleNames: string[], performedBy: string): Promise<User> {
    if (!Array.isArray(roleNames) || roleNames.length === 0) {
      throw new BadRequestException('Danh sách vai trò không được trống');
    }

    return this.dataSource.transaction(async (manager) => {
      const user = await this.findUserOrFail(userId, manager);
      const oldRoles = user.roles.map((r) => r.name).join(', ');
      user.roles = await this.resolveRoles(roleNames, manager);
      await this.userRepository.save(user, manager);

      await this.userRepository.saveAuditLog({
        action: 'UPDATE_ROLES',
        description: `Cập nhật vai trò từ [${oldRoles}] thành [${roleNames.join(', ')}]`,
        performedBy,
        user,
      }, manager);

      return user;
    });
  }

  private resolveStatus(input: string): string {
    const finalStatus = this.statusMap[input];
    if (!finalStatus) throw new BadRequestException('Trạng thái không hợp lệ');
    return finalStatus;
  }

  private async resolveRoles(roleNames: string[], manager: EntityManager): Promise<Role[]> {
    const roles = await this.userRepository.findRolesByNames(roleNames, manager);
    const found = new Set(roles.map((r) => r.name));
    const invalid = roleNames.filter((name) => !found.has(name));
    if (invalid.length > 0) {
      throw new BadRequestException(`Vai trò không hợp lệ: [${invalid.join(', ')}]`);
    }
    return roles;
  }

  private async findUserOrFail(userId: number, manager?: EntityManager): Promise<User> {
    const user = await this.userRepository.findFullById(userId, manager);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }
}
