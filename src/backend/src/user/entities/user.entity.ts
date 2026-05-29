import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToMany,
  JoinTable
} from 'typeorm';
import { Role } from './role.entity';

export enum UserRole {
  ADMIN = 'ADMIN', 
  PM = 'PRODUCT_MANAGER',       
  STAFF = 'STAFF'   
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  userID: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false }) 
  passwordHash: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 20, nullable: true })
  phoneNumber: string;

  @ManyToMany(() => Role, (role) => role.users, { cascade: true })
  @JoinTable({
    name: 'users_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'userID' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'roleID' }
  })
  roles: Role[];

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string; // ACTIVE, DEACTIVATED

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}