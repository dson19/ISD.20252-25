/**
 * Abstraction để Order yêu cầu hoàn tiền mà KHÔNG phụ thuộc concrete PaymentService.
 * OrderService inject qua token PAYMENT_SERVICE → DIP: tầng nghiệp vụ đơn hàng chỉ biết
 * "hoàn tiền nếu cổng hỗ trợ", không biết PayPal/VietQR hay cơ chế adapter bên trong.
 */
export interface IPaymentService {
  processRefundIfSupported(
    orderId: number,
    amount: number,
    method: string,
  ): Promise<{ automated: boolean }>;
}

export const PAYMENT_SERVICE = Symbol('PAYMENT_SERVICE');
