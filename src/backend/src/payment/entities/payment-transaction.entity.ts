import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToOne, JoinColumn, Check } from 'typeorm';
import { Order } from '../../order/entities/order.entity'; // 1. Đổi import từ Invoice sang Order
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

  // ==================== ĐOẠN THAY ĐỔI CỐT LÕI ĐÂY SƠN NHÉ ====================
  
  @ManyToOne(() => Order, { onDelete: 'CASCADE' }) // 2. Chuyển mối quan hệ hướng về thực thể Order
  @JoinColumn({ name: 'order_id' }) // 3. Đổi tên cột dưới DB Supabase thành order_id cho chuẩn chỉnh
  order: Order; // Thuộc tính này giờ là kiểu Order, giúp lấp đầy 2 lỗi đỏ ở Repo chung!

  // ===========================================================================

  @OneToOne(() => PaypalTransaction, (paypalTx) => paypalTx.paymentTransaction)
  paypalTransaction: PaypalTransaction;
}