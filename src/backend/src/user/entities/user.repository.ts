import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserRepository {
  private repository: Repository<User>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(User);
  }

  async findById(id: number): Promise<User | null> {
    return this.repository.findOne({
      where: { userID: id },
      relations: ['roles']
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
        updatedAt: true
      }
    });
  }

  async updateStatus(id: number, status: string): Promise<void> {
    await this.repository.update(id, { status });
  }

  async findAll(): Promise<User[]> {
    return this.repository.find({
      relations: ['roles']
    });
  }
}
