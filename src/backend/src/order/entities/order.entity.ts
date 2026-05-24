// src/orders/entities/order.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  OneToMany,
  OneToOne,
  Check
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { DeliveryInfo } from './delivery-info.entity';
import { Invoice } from './invoice.entity';

@Entity('orders')
@Check(`sub_total >= 0`)
@Check(`tax >= 0`) // Ràng buộc thêm check cho tax
@Check(`shipping_fee >= 0`)
@Check(`total_payment >= 0`)
export class Order {
  @PrimaryGeneratedColumn({ name: 'order_id' })
  orderID: number;

  @Column({ name: 'sub_total', type: 'decimal', precision: 12, scale: 2 })
  subTotal: number; // Tiền hàng gốc chưa thuế

  @Column({ name: 'tax', type: 'decimal', precision: 12, scale: 2, default: 0 })
  tax: number; // Tiền thuế VAT 10% của tiền hàng (= sub_total * 0.1)

  @Column({ name: 'shipping_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingFee: number; // Phí ship (Không bị đánh thuế)

  @Column({ name: 'total_payment', type: 'decimal', precision: 12, scale: 2 })
  totalPayment: number; // Tổng tiền chốt hạ = sub_total + tax + shipping_fee

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, { cascade: true })
  orderItems: OrderItem[];

  @OneToOne(() => DeliveryInfo, (deliveryInfo) => deliveryInfo.order)
  deliveryInfo: DeliveryInfo;

  @OneToOne(() => Invoice, (invoice) => invoice.order)
  invoice: Invoice;
}