import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { PaymentTransaction } from './payment-transaction.entity';

@Entity('paypal_transactions')
export class PaypalTransaction {
  @PrimaryGeneratedColumn({ name: 'paypal_transaction_id' })
  paypalTransactionID: number;

  @Column({ name: 'paypal_order_id', type: 'varchar', length: 100, nullable: true })
  paypalOrderID: string; // Mã Order ID từ API PayPal

  @Column({ name: 'paypal_capture_id', type: 'varchar', length: 100, nullable: true })
  paypalCaptureID: string; // Dùng cho Refund sau này

  @Column({ name: 'payer_id', type: 'varchar', length: 100, nullable: true })
  payerID: string; // ID ví PayPal của khách

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string; // Trạng thái riêng phía PayPal (COMPLETED, APPROVED...)

  @OneToOne(() => PaymentTransaction, (pt) => pt.paypalTransaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_id' })
  paymentTransaction: PaymentTransaction;
}