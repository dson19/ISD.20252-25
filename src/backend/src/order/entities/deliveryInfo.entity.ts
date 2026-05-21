import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

@Entity('delivery_info')
export class DeliveryInfo {
  @PrimaryGeneratedColumn({ name: 'delivery_id' })
  deliveryID: number;

  @Column({ name: 'receiver_name', type: 'varchar', length: 255 })
  receiverName: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 20 })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ type: 'varchar', length: 100 })
  province: string; // Tỉnh/Thành phố để tính phí ship

  @Column({ name: 'delivery_notes', type: 'text', nullable: true })
  deliveryNotes: string; 

  @OneToOne(() => Order, (order) => order.deliveryInfo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}