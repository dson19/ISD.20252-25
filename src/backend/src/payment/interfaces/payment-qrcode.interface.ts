import { VietqrCallbackDto } from '../dto/vietqr-callback.dto';

/**
 * Modality: MÃ QR / chuyển khoản ngân hàng (VietQR). Mô hình tạo QR → callback bị động từ ngân hàng.
 * KHÔNG có capture (tiền vào khi khách chuyển khoản), KHÔNG có refund tự động (hoàn tiền tay qua
 * OrderRefundService).
 *
 * Interface RIÊNG cho modality này — tách khỏi IPaymentCreditCard vì luồng khác bản chất (ISP).
 * PaymentService phụ thuộc abstraction này (DIP); mọi việc với PaymentTransaction do PaymentService lo,
 * service ở đây chỉ làm việc đặc thù cổng: gọi VietQR API + ghi VietqrTransaction.
 */
export interface VietqrPaymentResponse {
  paymentId: number;
  orderId: number;
  amount: number;
  transactionRef: string | null;
  content: string;
  paymentContent: string;
  qrCode: string | null;
  qrLink: string | null;
  expiredAt: Date;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
  bankCode?: string;
  bankAccount?: string;
  bankAccountName?: string;
}

/** Kết quả xử lý callback đã chuẩn hoá cho PaymentService quyết định hệ quả. */
export interface QrCallbackResult {
  /** true nếu lần callback này thực sự chuyển trạng thái PENDING → PAID (idempotent). */
  changed: boolean;
  paymentTransactionId: number;
  orderId: number;
  message: 'Callback processed' | 'Callback already processed';
}

/** Kết quả truy vấn trạng thái; cờ expired để PaymentService set PaymentTransaction FAILED. */
export interface QrStatusResult {
  response: VietqrPaymentResponse;
  expired: boolean;
  paymentTransactionId: number;
}

export interface IPaymentQRCode {
  /** Discriminator để PaymentService định tuyến theo phương thức (vd 'VIETQR'). */
  readonly method: string;

  /** Tìm giao dịch QR đang chờ có thể tái dùng (cùng order + amount) để không tạo QR/tx trùng. */
  findReusablePending(orderId: number, amount: number): Promise<VietqrPaymentResponse | null>;

  /** Sinh QR phía cổng + ghi VietqrTransaction liên kết paymentTransactionId. */
  createPayment(
    orderId: number,
    amount: number,
    content: string,
    paymentTransactionId: number,
  ): Promise<VietqrPaymentResponse>;

  /** Xử lý callback ngân hàng (validate + đánh dấu đã trả); KHÔNG đụng PaymentTransaction/Order. */
  handleCallback(dto: VietqrCallbackDto): Promise<QrCallbackResult>;

  getStatusByPaymentId(paymentId: number): Promise<QrStatusResult>;
  getStatusByTransactionRef(transactionRef: string): Promise<QrStatusResult>;
  triggerTestCallback(paymentId: number): Promise<{ status: string }>;
}

export const PAYMENT_QR_CODE = Symbol('PAYMENT_QR_CODE');
