import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn, Check } from 'typeorm';
import { Order } from './order.entity';

@Entity('invoices')
@Check(`total_exclude_vat >= 0`)
@Check(`total_include_vat >= 0`)
@Check(`shipping_fee >= 0`)
@Check(`total_payment >= 0`)
export class Invoice {
  @PrimaryGeneratedColumn({ name: 'invoice_id' })
  invoiceID: number;

  @Column({ name: 'total_exclude_vat', type: 'decimal', precision: 12, scale: 2 })
  totalExcludeVAT: number; 

  @Column({ name: 'total_include_vat', type: 'decimal', precision: 12, scale: 2 })
  totalIncludeVAT: number; 

  @Column({ name: 'shipping_fee', type: 'decimal', precision: 12, scale: 2 })
  shippingFee: number; 

  @Column({ name: 'total_payment', type: 'decimal', precision: 12, scale: 2 })
  totalPayment: number; 

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToOne(() => Order, (order) => order.invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}