/**
 * Modality: THẺ TÍN DỤNG (PayPal). Mô hình authorize → capture → refund tự động.
 *
 * Interface RIÊNG cho modality này thay vì một IPaymentAdapter chung — vì luồng thẻ tín dụng
 * (chủ động capture, có refund API) khác bản chất với luồng QR (callback bị động, không refund tự động).
 * Một interface gượng ép sẽ vi phạm ISP. PaymentService phụ thuộc abstraction này (DIP), không phụ
 * thuộc concrete PaypalService.
 *
 * Mọi việc liên quan PaymentTransaction (bảng chung) do PaymentService lo — service ở đây chỉ làm
 * việc đặc thù cổng: gọi PayPal API + ghi PaypalTransaction (kho riêng của cổng).
 */
export interface CreditCardCaptureResult {
  /** Cổng đã xác nhận thu tiền thành công hay chưa. */
  completed: boolean;
  /** ID giao dịch trong bảng chung payment_transactions (để PaymentService cập nhật trạng thái). */
  paymentTransactionId: number | null;
  /** Payload thô từ cổng, controller trả thẳng cho frontend. */
  raw: any;
}

export interface IPaymentCreditCard {
  /** Discriminator để PaymentService định tuyến theo phương thức (vd 'PAYPAL'). */
  readonly method: string;

  /** Tạo đơn thanh toán phía cổng + ghi PaypalTransaction liên kết paymentTransactionId. */
  createOrder(orderId: number, amount: number, paymentTransactionId: number): Promise<any>;

  /** Chủ động capture tiền; trả về kết quả đã chuẩn hoá cho PaymentService xử lý hệ quả. */
  captureOrder(gatewayOrderId: string, orderId: number): Promise<CreditCardCaptureResult>;

  /** Hoàn tiền tự động qua API cổng; chỉ cập nhật trạng thái phía cổng (PaypalTransaction). */
  refund(orderId: number): Promise<any>;
}

export const PAYMENT_CREDIT_CARD = Symbol('PAYMENT_CREDIT_CARD');