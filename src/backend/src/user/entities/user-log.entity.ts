// src/users/entities/user-log.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  ManyToOne, 
  JoinColumn 
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_audit_logs')
export class UserAuditLog {
  @PrimaryGeneratedColumn({ name: 'log_id' })
  logID: number;

  @Column({ name: 'action', type: 'varchar', length: 100 })
  action: string; 

  @Column({ type: 'text', nullable: true })
  description: string; 

  @Column({ name: 'performed_by', type: 'varchar', length: 50, nullable: true })
  performedBy: string; 

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date; 

  @ManyToOne(() => User, { onDelete: 'SET NULL' }) // Nếu User bị xóa, log vẫn giữ lại để đối soát và để trống trường này
  @JoinColumn({ name: 'user_id' })
  user: User;
}