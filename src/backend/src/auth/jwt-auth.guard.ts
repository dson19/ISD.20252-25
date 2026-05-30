import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret = process.env.JWT_SECRET || 'aims_secret_key_2026';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Không có quyền truy cập: Token thiếu hoặc không hợp lệ');
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      request.user = decoded;
      return true;
    } catch (err) {
      throw new UnauthorizedException('Không có quyền truy cập: Phiên đăng nhập đã hết hạn hoặc không hợp lệ');
    }
  }
}
