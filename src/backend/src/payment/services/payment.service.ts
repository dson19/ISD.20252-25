import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { PaypalAdapter } from '../adapters/paypal-adapter';
import { VietqrAdapter } from '../adapters/vietqr-adapter';
import { IPaymentAdapter } from '../interfaces/payment-adapter.interface';
import { PaymentRepository } from '../repositories/payment.repository';

/**
 * Template Method pattern: processPayment and processRefund define the skeleton algorithm;
 * the concrete adapter chosen per payment method provides the varying steps.
 */
@Injectable()
export class PaymentService {
  private readonly adapterMap: Record<string, IPaymentAdapter>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly paymentRepository: PaymentRepository,
    private readonly paypalAdapter: PaypalAdapter,
    private readonly vietqrAdapter: VietqrAdapter,
  ) {
    this.adapterMap = {
      PAYPAL: this.paypalAdapter,
      VIETQR: this.vietqrAdapter,
    };
  }

  async processPayment(orderId: number, amount: number, method: string): Promise<any> {
    const order = await this.dataSource.getRepository(Order).findOne({ where: { orderID: orderId } });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const adapter = this.getAdapter(method);
    const gatewayResponse = await adapter.createPaymentRequest(orderId, amount);

    await this.paymentRepository.createTransaction(orderId, amount, method as 'PAYPAL' | 'VIETQR', `${method} payment for order ${orderId}`);

    return gatewayResponse;
  }

  async processRefund(orderId: number, amount: number, method: string): Promise<any> {
    const transaction = await this.paymentRepository.findTransactionByOrderId(orderId);
    if (!transaction) {
      throw new NotFoundException(`No transaction found for order ${orderId}`);
    }

    const adapter = this.getAdapter(method);
    const result = await adapter.executeRefund({ orderId, transaction }, amount);

    if (result?.status !== 'REFUND_PENDING') {
      await this.paymentRepository.updateTransactionStatus(transaction.transactionID, 'REFUNDED');
    }

    return result;
  }

  private getAdapter(method: string): IPaymentAdapter {
    const adapter = this.adapterMap[method?.toUpperCase()];
    if (!adapter) {
      throw new NotFoundException(`No payment adapter found for method: ${method}`);
    }
    return adapter;
  }
}
