import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { UserRepository } from '../user/entities/user.repository';
import { User } from '../user/entities/user.entity';
import { UserAuditLog } from '../user/entities/user-log.entity';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'aims_secret_key_2026';

  constructor(
    private readonly userRepository: UserRepository,
    private readonly dataSource: DataSource,
  ) {}

  async login(email: string, pass: string) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa hoặc khóa');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }

    const roles = user.roles.map((role) => role.name);
    const token = jwt.sign(
      {
        userID: user.userID,
        email: user.email,
        fullName: user.fullName,
        roles,
      },
      this.jwtSecret,
      { expiresIn: '24h' },
    );

    return {
      token,
      user: {
        userID: user.userID,
        email: user.email,
        fullName: user.fullName,
        roles,
      },
    };
  }

  async changePassword(userId: number, oldPass: string, newPass: string) {
    if (!newPass || newPass.trim().length < 6) {
      throw new BadRequestException('Mật khẩu mới phải có ít nhất 6 ký tự');
    }

    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await userRepo.findOne({
        where: { userID: userId },
        select: ['userID', 'passwordHash', 'email'],
      });

      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      const isMatch = await bcrypt.compare(oldPass, user.passwordHash);
      if (!isMatch) {
        throw new BadRequestException('Mật khẩu cũ không chính xác');
      }

      user.passwordHash = await bcrypt.hash(newPass, 10);
      await userRepo.save(user);

      // Log change password action
      const logRepo = manager.getRepository(UserAuditLog);
      const log = logRepo.create({
        action: 'CHANGE_PASSWORD',
        description: 'Người dùng tự đổi mật khẩu cá nhân',
        performedBy: user.email,
        user,
      });
      await logRepo.save(log);
    });

    return { success: true, message: 'Đổi mật khẩu thành công' };
  }

  async resetPassword(targetUserId: number, adminUser: any) {
    const rawNewPassword = crypto.randomBytes(4).toString('hex').toUpperCase(); // Sinh mật khẩu ngẫu nhiên ngắn gọn 8 ký tự
    const hash = await bcrypt.hash(rawNewPassword, 10);

    const targetUser = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await userRepo.findOne({
        where: { userID: targetUserId },
        relations: ['roles'],
      });

      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng cần reset mật khẩu');
      }

      user.passwordHash = hash;
      await userRepo.save(user);

      // Log reset password action
      const logRepo = manager.getRepository(UserAuditLog);
      const log = logRepo.create({
        action: 'RESET_PASSWORD',
        description: `Admin reset mật khẩu. Mật khẩu mới ngẫu nhiên được cấp phát.`,
        performedBy: adminUser.email,
        user,
      });
      await logRepo.save(log);

      return user;
    });

    return {
      success: true,
      message: 'Reset mật khẩu thành công',
      newPassword: rawNewPassword,
      email: targetUser.email,
      fullName: targetUser.fullName,
    };
  }
}
