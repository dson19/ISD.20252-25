import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToOne, JoinColumn, Check } from 'typeorm';
import { Invoice } from '../../order/entities/invoice.entity'; 
import { PaypalTransaction } from './paypal-transaction.entity';

@Entity('payment_transactions')
@Check(`amount > 0`)
export class PaymentTransaction {
  @PrimaryGeneratedColumn({ name: 'transaction_id' })
  transactionID: number;

  @Column({ type: 'varchar', length: 45 })
  method: string; // PAYPAL, VIETQR

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number; // Số tiền thực tế ghi nhận thành công

  @Column({ name: 'transaction_content', type: 'text', nullable: true })
  transactionContent: string; // Nội dung phản hồi từ webhook cổng thanh toán

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  status: string; // PENDING, SUCCESS, FAILED

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @OneToOne(() => PaypalTransaction, (paypalTx) => paypalTx.paymentTransaction)
  paypalTransaction: PaypalTransaction;
}