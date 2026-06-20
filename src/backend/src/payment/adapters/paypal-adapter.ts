import { Injectable } from '@nestjs/common';
import { IRefundableAdapter } from '../interfaces/payment-adapter.interface';
import { PaypalService } from '../services/paypal.service';

/**
 * Adapter wrapping PaypalService. PayPal exposes a refund API, so it implements
 * IRefundableAdapter — the type system guarantees executeRefund exists.
 */
@Injectable()
export class PaypalAdapter implements IRefundableAdapter {
  readonly method = 'PAYPAL';

  constructor(private readonly paypalService: PaypalService) {}

  async createPaymentRequest(orderId: number, _amount: number, _options?: Record<string, unknown>): Promise<any> {
    return this.paypalService.createOrderInPaypal(orderId);
  }

  async executeRefund(transaction: any, _amount: number): Promise<any> {
    const orderId = transaction?.orderId ?? transaction?.order?.orderID ?? transaction;
    return this.paypalService.refundOrderInPaypal(orderId, false);
  }
}
