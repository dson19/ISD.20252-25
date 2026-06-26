import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { OrderRepository } from '../../order/order.repository';
import { NotificationEventBus } from '../../notification/events/notification-event-bus';
import { VietqrCallbackDto } from '../dto/vietqr-callback.dto';
import { PaymentRepository } from '../repositories/payment.repository';
import { PAYMENT_CREDIT_CARD } from '../interfaces/payment-creditcard.interface';
import type { IPaymentCreditCard } from '../interfaces/payment-creditcard.interface';
import { PAYMENT_QR_CODE } from '../interfaces/payment-qrcode.interface';
import type { IPaymentQRCode, VietqrPaymentResponse } from '../interfaces/payment-qrcode.interface';
import type { IPaymentService } from '../interfaces/payment-service.interface';

/**
 * Facade ĐIỀU PHỐI thanh toán và là OWNER DUY NHẤT của PaymentTransaction (bảng chung).
 *
 * + Coupling/Cohesion level:
 *   - Data Coupling: Trao đổi tham số nguyên thủy với repositories và các modality service qua abstraction.
 *   - Functional Cohesion: Mọi method xoay quanh một trách nhiệm — điều phối vòng đời một giao dịch
 *     thanh toán (tạo tx → ủy quyền cổng → cập nhật hệ quả).
 *
 * + SOLID Principles Review:
 *   - SRP Adherence: Là application service điều phối; việc nặng (gọi cổng, lưu trữ, gửi thông báo)
 *     đều ỦY QUYỀN. PaymentTransaction sống một chỗ tại đây thay vì rải ở các modality service.
 *   - OCP/ISP/DIP Adherence: Phụ thuộc HAI abstraction theo modality — IPaymentCreditCard (PayPal,
 *     có capture + refund) và IPaymentQRCode (VietQR, callback bị động, không refund tự động). Hai
 *     interface riêng (ISP) phản ánh đúng bản chất khác nhau, thay cho một IPaymentAdapter gượng ép.
 *     Đồng thời implements IPaymentService (token PAYMENT_SERVICE) để OrderService phụ thuộc abstraction.
 */
@Injectable()
export class PaymentService implements IPaymentService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly paymentRepository: PaymentRepository,
    private readonly orderRepository: OrderRepository,
    private readonly eventBus: NotificationEventBus,
    @Inject(PAYMENT_CREDIT_CARD) private readonly creditCard: IPaymentCreditCard,
    @Inject(PAYMENT_QR_CODE) private readonly qrCode: IPaymentQRCode,
  ) {}

  // ---- Credit card modality (PayPal) ----

  /** Tạo đơn thẻ tín dụng: PaymentService tạo PaymentTransaction (VND) rồi ủy quyền cổng tạo đơn. */
  async createCreditCardOrder(orderId: number): Promise<any> {
    const order = await this.dataSource.getRepository(Order).findOne({ where: { orderID: orderId } });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    const amount = Math.round(Number(order.totalPayment));

    const tx = await this.paymentRepository.createTransaction(orderId, amount, 'PAYPAL', `PAYPAL payment for order ${orderId}`);
    try {
      return await this.creditCard.createOrder(orderId, amount, tx.transactionID);
    } catch (error) {
      await this.paymentRepository.updateTransactionStatusIfCurrent(tx.transactionID, 'PENDING', 'FAILED');
      throw error;
    }
  }

  /** Capture thẻ tín dụng: ủy quyền cổng capture, nếu thành công thì áp hệ quả chung. */
  async captureCreditCardOrder(gatewayOrderId: string, orderId: number): Promise<any> {
    const result = await this.creditCard.captureOrder(gatewayOrderId, orderId);
    if (result.completed && result.paymentTransactionId) {
      await this.onPaymentConfirmed(result.paymentTransactionId, orderId);
    }
    return result.raw;
  }

  // ---- QR code modality (VietQR) ----

  /** Tạo thanh toán QR: tái dùng giao dịch chờ nếu có, ngược lại tạo PaymentTransaction rồi ủy quyền cổng. */
  async createQrPayment(orderId: number, amount: number, content: string): Promise<VietqrPaymentResponse> {
    const reusable = await this.qrCode.findReusablePending(orderId, amount);
    if (reusable) {
      return reusable;
    }

    const normalizedAmount = Math.round(amount);
    const tx = await this.paymentRepository.createTransaction(orderId, normalizedAmount, 'VIETQR', content);
    try {
      return await this.qrCode.createPayment(orderId, normalizedAmount, content, tx.transactionID);
    } catch (error) {
      await this.paymentRepository.updateTransactionStatusIfCurrent(tx.transactionID, 'PENDING', 'FAILED');
      throw error;
    }
  }

  /** Callback ngân hàng: ủy quyền cổng xác thực, nếu vừa chuyển sang PAID thì áp hệ quả chung. */
  async handleQrCallback(dto: VietqrCallbackDto): Promise<{ status: 'SUCCESS'; message: string; paymentId: number }> {
    const result = await this.qrCode.handleCallback(dto);
    if (result.changed) {
      await this.onPaymentConfirmed(result.paymentTransactionId, result.orderId);
    }
    return { status: 'SUCCESS', message: result.message, paymentId: result.paymentTransactionId };
  }

  async getQrStatusByPaymentId(paymentId: number): Promise<VietqrPaymentResponse> {
    const status = await this.qrCode.getStatusByPaymentId(paymentId);
    await this.markFailedIfExpired(status.expired, status.paymentTransactionId);
    return status.response;
  }

  async getQrStatusByTransactionRef(transactionRef: string): Promise<VietqrPaymentResponse> {
    const status = await this.qrCode.getStatusByTransactionRef(transactionRef);
    await this.markFailedIfExpired(status.expired, status.paymentTransactionId);
    return status.response;
  }

  triggerQrTestCallback(paymentId: number): Promise<{ status: string }> {
    return this.qrCode.triggerTestCallback(paymentId);
  }

  // ---- Refund (do OrderService gọi qua IPaymentService) ----

  /**
   * Hoàn tiền NẾU cổng hỗ trợ tự động. Chỉ modality thẻ tín dụng (creditCard) có refund API; QR trả
   * { automated: false } để OrderRefundService xử lý hoàn tiền tay. Định tuyến theo tên phương thức,
   * không if theo PAYPAL/VIETQR cứng → thêm cổng cùng modality không phải sửa hàm này.
   */
  async processRefundIfSupported(orderId: number, amount: number, method: string): Promise<{ automated: boolean }> {
    if (!this.isCreditCard(method)) {
      return { automated: false };
    }
    await this.processRefund(orderId);
    return { automated: true };
  }

  /** Thực thi hoàn tiền tự động: ủy quyền cổng refund + đánh dấu PaymentTransaction REFUNDED. */
  async processRefund(orderId: number): Promise<any> {
    const transaction = await this.paymentRepository.findTransactionByOrderId(orderId);
    if (!transaction) {
      throw new NotFoundException(`No transaction found for order ${orderId}`);
    }

    const result = await this.creditCard.refund(orderId);
    await this.paymentRepository.updateTransactionStatus(transaction.transactionID, 'REFUNDED');
    return result;
  }

  // ---- Hệ quả dùng chung ----

  /**
   * Phần đuôi GIỐNG NHAU của PayPal capture và VietQR callback: khi cổng xác nhận tiền đã vào →
   * đánh dấu PaymentTransaction SUCCESS + đưa Order sang PENDING_PROCESSING + publish sự kiện.
   * Gộp một chỗ để không lặp logic ở hai luồng (capture chủ động vs callback bị động).
   */
  private async onPaymentConfirmed(paymentTransactionId: number, orderId: number): Promise<void> {
    await this.paymentRepository.updateTransactionStatusIfCurrent(paymentTransactionId, 'PENDING', 'SUCCESS');
    await this.orderRepository.updateStatus(orderId, 'PENDING_PROCESSING');
    this.eventBus.publish({
      type: 'ORDER_PAYMENT_SUCCEEDED',
      orderId,
      paymentTransactionId,
    });
  }

  private async markFailedIfExpired(expired: boolean, paymentTransactionId: number): Promise<void> {
    if (expired) {
      await this.paymentRepository.updateTransactionStatusIfCurrent(paymentTransactionId, 'PENDING', 'FAILED');
    }
  }

  private isCreditCard(method: string): boolean {
    return method?.toUpperCase() === this.creditCard.method;
  }
}
