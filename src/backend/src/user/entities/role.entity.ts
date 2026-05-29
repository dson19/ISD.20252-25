import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { User } from './user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn({ name: 'role_id' })
  roleID: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  name: string; // 'ADMIN', 'PRODUCT_MANAGER', 'STAFF'

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];
}
