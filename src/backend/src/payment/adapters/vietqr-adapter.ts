import { Injectable } from '@nestjs/common';
import { IPaymentAdapter } from '../interfaces/payment-adapter.interface';
import { VietqrPaymentService } from '../services/vietqr-payment.service';

/**
 * Adapter wrapping VietqrPaymentService. VietQR has no refund API, so it implements
 * only IPaymentAdapter (not IRefundableAdapter). It is therefore impossible — by type —
 * to ask this adapter to perform an automated refund; refunds are handled manually by
 * the Product Manager and the order is marked REFUND_PENDING upstream.
 */
@Injectable()
export class VietqrAdapter implements IPaymentAdapter {
  readonly method = 'VIETQR';

  constructor(private readonly vietqrPaymentService: VietqrPaymentService) {}

  async createPaymentRequest(orderId: number, amount: number): Promise<any> {
    return this.vietqrPaymentService.createPayment({
      orderId,
      amount,
      content: `ORDER${orderId}`,
    });
  }
}
