import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';
import { UserAuditLog } from './user-log.entity';

@Injectable()
export class UserRepository {
  private readonly repository: Repository<User>;
  private readonly auditLogRepository: Repository<UserAuditLog>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(User);
    this.auditLogRepository = this.dataSource.getRepository(UserAuditLog);
  }

  async findById(id: number): Promise<User | null> {
    return this.repository.findOne({
      where: { userID: id },
      relations: ['roles'],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
      relations: ['roles'],
      select: {
        userID: true,
        email: true,
        passwordHash: true,
        fullName: true,
        status: true,
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateStatus(id: number, status: string): Promise<void> {
    await this.repository.update(id, { status });
  }

  async findAll(): Promise<User[]> {
    return this.repository.find({
      relations: ['roles'],
      order: { userID: 'ASC' },
    });
  }

  async findFullById(userId: number, manager?: EntityManager): Promise<User | null> {
    const mgr = manager ?? this.dataSource.manager;
    return mgr.findOne(User, {
      where: { userID: userId },
      relations: ['roles'],
    });
  }

  async findByEmailInTransaction(email: string, manager: EntityManager): Promise<User | null> {
    return manager.findOne(User, { where: { email } });
  }

  async save(user: User, manager?: EntityManager): Promise<User> {
    if (manager) return manager.save(User, user);
    return this.repository.save(user);
  }

  async updatePartial(userId: number, data: Partial<User>, manager: EntityManager): Promise<void> {
    await manager.update(User, userId, data);
  }

  async findAuditLogs(userId: number, limit = 10): Promise<UserAuditLog[]> {
    return this.auditLogRepository.find({
      where: { user: { userID: userId } },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /** Toàn bộ user logs (gộp mọi user) cho trang Admin Logs — kèm relation user để hiện email/tên. */
  async findAllUserLogs(): Promise<UserAuditLog[]> {
    return this.auditLogRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async saveAuditLog(
    params: { action: string; description: string; performedBy: string; user: User },
    manager: EntityManager,
  ): Promise<void> {
    const logRepo = manager.getRepository(UserAuditLog);
    await logRepo.save(logRepo.create(params));
  }

  async findRolesByNames(names: string[], manager: EntityManager): Promise<Role[]> {
    return manager.find(Role, { where: names.map((name) => ({ name })) });
  }
}
