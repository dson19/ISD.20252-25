import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToOne, JoinColumn, Check } from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { PaypalTransaction } from './paypal-transaction.entity';

@Entity('payment_transactions')
@Check(`amount > 0`)
/**
 * Lab 11 Design Review
 * Coupling:
 * - Data Coupling with gateway-specific transaction entities because it stores shared payment fields and relation ids only.
 * - Avoids Control Coupling by not deciding which gateway flow should run.
 * - Avoids Stamp Coupling by not embedding PayPal or VietQR request/response objects in the shared transaction table.
 *
 * Cohesion:
 * - Functional Cohesion because this entity represents one shared payment transaction record.
 *
 * Reason:
 * - VietQR-specific QR and callback data belongs in a separate entity while this entity keeps gateway-neutral payment state.
 *
 * Improvement Direction:
 * - Replace string status/method columns with enums when schema migration control is introduced.
 */
export class PaymentTransaction {
  @PrimaryGeneratedColumn({ name: 'transaction_id' })
  transactionID: number;

  @Column({ type: 'varchar', length: 45 })
  method: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'transaction_content', type: 'text', nullable: true })
  transactionContent: string;

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @OneToOne(() => PaypalTransaction, (paypalTx) => paypalTx.paymentTransaction)
  paypalTransaction: PaypalTransaction;
}
