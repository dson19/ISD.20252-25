import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserAuditLog } from './entities/user-log.entity';
import { Role } from './entities/role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserAuditLog, Role]),
  ],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class UserModule {}
