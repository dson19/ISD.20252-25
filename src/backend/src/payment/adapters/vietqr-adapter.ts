import { Injectable } from '@nestjs/common';
import { IPaymentAdapter } from '../interfaces/payment-adapter.interface';
import { VietqrPaymentService } from '../services/vietqr-payment.service';

@Injectable()
export class VietqrAdapter implements IPaymentAdapter {
  constructor(private readonly vietqrPaymentService: VietqrPaymentService) {}

  async createPaymentRequest(orderId: number, amount: number): Promise<any> {
    return this.vietqrPaymentService.createPayment({
      orderId,
      amount,
      content: `ORDER${orderId}`,
    });
  }

  async executeRefund(_transaction: any, _amount: number): Promise<any> {
    // VietQR refunds are handled manually via confirmVietqrRefund in OrderService.
    // Return a pending refund indication so callers can set status accordingly.
    return { status: 'REFUND_PENDING' };
  }
}
