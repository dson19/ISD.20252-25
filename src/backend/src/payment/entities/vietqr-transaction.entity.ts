import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentTransaction } from './payment-transaction.entity';
import type { VietqrPaymentStatus } from '../vietqr.types';

@Entity('vietqr_transactions')
/**
 * Lab 11 Design Review
 * Coupling:
 * - Data Coupling with PaymentTransaction because it references only the shared transaction id and VietQR-specific values.
 * - Avoids Control Coupling by storing VietQR state without selecting or controlling other payment gateway behavior.
 * - Avoids Stamp Coupling by persisting selected QR/callback fields instead of full external API response objects.
 *
 * Cohesion:
 * - Functional Cohesion because this entity models only VietQR transaction data for the PayOrder flow.
 *
 * Reason:
 * - Separating VietQR data from the shared payment transaction keeps gateway-specific persistence cohesive and easier to extend.
 *
 * Improvement Direction:
 * - Add database-level unique constraints for transaction references when migrations are managed explicitly.
 */
export class VietqrTransaction {
  @PrimaryGeneratedColumn({ name: 'vietqr_transaction_id' })
  vietqrTransactionID: number;

  @OneToOne(() => PaymentTransaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_id' })
  paymentTransaction: PaymentTransaction;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 23 })
  content: string;

  @Column({ name: 'qr_code', type: 'text', nullable: true })
  qrCode: string | null;

  @Column({ name: 'qr_link', type: 'text', nullable: true })
  qrLink: string | null;

  @Column({ name: 'transaction_id_ref', type: 'varchar', length: 100, nullable: true })
  transactionId: string | null;

  @Column({ name: 'transaction_ref_id', type: 'varchar', length: 100, nullable: true })
  transactionRefId: string | null;

  @Column({ name: 'expired_at', type: 'timestamptz' })
  expiredAt: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  status: VietqrPaymentStatus;

  @Column({ name: 'raw_callback', type: 'jsonb', nullable: true })
  rawCallback: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
