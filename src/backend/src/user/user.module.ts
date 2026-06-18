import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { UserAuditLog } from './entities/user-log.entity';
import { Role } from './entities/role.entity';
import { UserRepository } from './entities/user.repository';
import { UserAdminController } from './user-admin.controller';
import { UserAdminService } from './services/user-admin.service';
import { BcryptPasswordHasher } from './services/bcrypt-password-hasher';
import { PASSWORD_HASHER } from './interfaces/password-hasher.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserAuditLog, Role]),
  ],
  controllers: [UserAdminController],
  providers: [
    UserRepository,
    UserAdminService,
    // DIP: bind the IPasswordHasher abstraction to its bcrypt implementation.
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
  ],
  exports: [TypeOrmModule, UserRepository],
})
export class UserModule implements OnApplicationBootstrap {
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    const manager = this.dataSource.manager;
    
    // 1. Seed Roles
    const roleRepo = manager.getRepository(Role);
    const rolesToSeed = ['ADMIN', 'PRODUCT_MANAGER', 'STAFF'];
    for (const roleName of rolesToSeed) {
      const exists = await roleRepo.findOneBy({ name: roleName });
      if (!exists) {
        await roleRepo.save(roleRepo.create({ name: roleName }));
        console.log(`[SEED] Created role: ${roleName}`);
      }
    }

    // 2. Seed Users
    const userRepo = manager.getRepository(User);
    const defaultUsers = [
      {
        email: 'admin@aims.vn',
        fullName: 'Admin AIMS',
        roleName: 'ADMIN',
      },
      {
        email: 'pm@aims.vn',
        fullName: 'Product Manager AIMS',
        roleName: 'PRODUCT_MANAGER',
      },
      {
        email: 'staff@aims.vn',
        fullName: 'Staff AIMS',
        roleName: 'STAFF',
      },
      {
        email: 'adminpm@aims.vn',
        fullName: 'Admin & PM Dual AIMS',
        roleNames: ['ADMIN', 'PRODUCT_MANAGER'],
      }
    ];

    const hash = await bcrypt.hash('123456', 10);

    for (const u of defaultUsers) {
      const exists = await userRepo.findOne({
        where: { email: u.email },
        relations: ['roles']
      });

      let userRoles: Role[] = [];
      const roleNames = (u as any).roleNames;
      if (roleNames && Array.isArray(roleNames)) {
        for (const rName of roleNames) {
          const role = await roleRepo.findOneBy({ name: rName });
          if (role) userRoles.push(role);
        }
      } else {
        const role = await roleRepo.findOneBy({ name: (u as any).roleName });
        if (role) userRoles.push(role);
      }

      if (!exists) {
        const newUser = userRepo.create({
          email: u.email,
          fullName: u.fullName,
          passwordHash: hash,
          status: 'ACTIVE',
          roles: userRoles
        });
        await userRepo.save(newUser);
        console.log(`[SEED] Created default user: ${u.email}`);
      } else {
        // Enforce the default password and status ACTIVE to make sure testing works instantly
        exists.passwordHash = hash;
        exists.status = 'ACTIVE';
        exists.roles = userRoles;
        await userRepo.save(exists);
        console.log(`[SEED] Ensured default user exists with active status and password '123456': ${u.email}`);
      }
    }
  }
}

