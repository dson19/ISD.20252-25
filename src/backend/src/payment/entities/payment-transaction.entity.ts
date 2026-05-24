import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToOne, JoinColumn, Check } from 'typeorm';
import { Order } from '../../order/entities/order.entity'; // 1. Đổi import từ Invoice sang Order
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
  method: string; // PAYPAL, VIETQR

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number; // Số tiền thực tế ghi nhận thành công

  @Column({ name: 'transaction_content', type: 'text', nullable: true })
  transactionContent: string; // Nội dung phản hồi từ webhook cổng thanh toán

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  status: string; // PENDING, SUCCESS, FAILED

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // ==================== ĐOẠN THAY ĐỔI CỐT LÕI ĐÂY SƠN NHÉ ====================
  
  @ManyToOne(() => Order, { onDelete: 'CASCADE' }) // 2. Chuyển mối quan hệ hướng về thực thể Order
  @JoinColumn({ name: 'order_id' }) // 3. Đổi tên cột dưới DB Supabase thành order_id cho chuẩn chỉnh
  order: Order; // Thuộc tính này giờ là kiểu Order, giúp lấp đầy 2 lỗi đỏ ở Repo chung!

  // ===========================================================================

  @OneToOne(() => PaypalTransaction, (paypalTx) => paypalTx.paymentTransaction)
  paypalTransaction: PaypalTransaction;
}
