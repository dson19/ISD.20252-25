import { Injectable } from '@nestjs/common';
import { IPaymentAdapter } from '../interfaces/payment-adapter.interface';
import { PaypalService } from '../services/paypal.service';

@Injectable()
export class PaypalAdapter implements IPaymentAdapter {
  readonly supportsAutomatedRefund = true;

  constructor(private readonly paypalService: PaypalService) {}

  async createPaymentRequest(orderId: number, _amount: number): Promise<any> {
    return this.paypalService.createOrderInPaypal(orderId);
  }

  async executeRefund(transaction: any, _amount: number): Promise<any> {
    const orderId = transaction?.orderId ?? transaction?.order?.orderID ?? transaction;
    return this.paypalService.refundOrderInPaypal(orderId, false);
  }
}
