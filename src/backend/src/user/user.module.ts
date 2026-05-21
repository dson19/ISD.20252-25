import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserAuditLog } from './entities/userLog.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserAuditLog]),
  ],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class UserModule {}
