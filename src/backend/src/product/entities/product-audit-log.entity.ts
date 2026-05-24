import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  ManyToOne, 
  JoinColumn 
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_logs')
export class ProductLog {
  @PrimaryGeneratedColumn({ name: 'log_id' })
  logID: number;

  @Column({ name: 'action_type', type: 'varchar', length: 20 })
  actionType: string; 

  @Column({ name: 'changed_fields', type: 'jsonb', nullable: true })
  changedFields: any; 

  @Column({ name: 'performed_by', type: 'varchar', length: 100, default: 'SYSTEM' })
  performedBy: string; 

  @Column({ type: 'text', nullable: true })
  reason: string; 

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date; 

  
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}