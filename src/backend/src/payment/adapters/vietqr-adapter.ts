import { Injectable, NotImplementedException } from '@nestjs/common';
import { IPaymentAdapter } from '../interfaces/payment-adapter.interface';
import { VietqrPaymentService } from '../services/vietqr-payment.service';

@Injectable()
export class VietqrAdapter implements IPaymentAdapter {
  readonly supportsAutomatedRefund = false;

  constructor(private readonly vietqrPaymentService: VietqrPaymentService) {}

  async createPaymentRequest(orderId: number, amount: number): Promise<any> {
    return this.vietqrPaymentService.createPayment({
      orderId,
      amount,
      content: `ORDER${orderId}`,
    });
  }

  async executeRefund(_transaction: any, _amount: number): Promise<never> {
    // VietQR has no refund API — refunds must be processed manually by the Product Manager.
    throw new NotImplementedException(
      'VietQR does not support automated refunds. Please process the refund manually.',
    );
  }
}
