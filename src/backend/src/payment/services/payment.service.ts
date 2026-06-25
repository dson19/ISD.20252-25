import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import {
  IPaymentAdapter,
  isRefundable,
  PAYMENT_ADAPTERS,
} from '../interfaces/payment-adapter.interface';
import { PaymentRepository } from '../repositories/payment.repository';
import type { IPaymentService } from '../interfaces/payment-service.interface';

/**
 * Template Method pattern: processPayment / processRefund define the fixed AIMS skeleton
 * (validate -> call gateway -> persist), delegating the gateway-specific step to an adapter.
 *
 * + SOLID Principles Review:
 *   - OCP Adherence: Adapters are injected as an array via PAYMENT_ADAPTERS and indexed by
 *     adapter.method. Adding a gateway (VNPay/MoMo) needs only a new adapter + provider entry —
 *     this service is never modified.
 *   - DIP Adherence: Depends on the IPaymentAdapter abstraction, not on PaypalAdapter/VietqrAdapter.
 *     Đồng thời implements IPaymentService để OrderService phụ thuộc abstraction (token PAYMENT_SERVICE),
 *     không phụ thuộc concrete class này.
 *   - LSP Adherence: Refund is only attempted on adapters narrowed to IRefundableAdapter.
 */
@Injectable()
export class PaymentService implements IPaymentService {
  private readonly adapterMap: Map<string, IPaymentAdapter>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly paymentRepository: PaymentRepository,
    @Inject(PAYMENT_ADAPTERS) adapters: IPaymentAdapter[],
  ) {
    // Build the lookup dynamically from each adapter's own `method` — no hardcoded gateway names.
    this.adapterMap = new Map(adapters.map((adapter) => [adapter.method, adapter]));
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
    if (!isRefundable(adapter)) {
      throw new NotFoundException(`Payment method ${method} does not support automated refunds`);
    }

    const result = await adapter.executeRefund({ orderId, transaction }, amount);
    await this.paymentRepository.updateTransactionStatus(transaction.transactionID, 'REFUNDED');
    return result;
  }

  async processRefundIfSupported(
    orderId: number,
    amount: number,
    method: string,
  ): Promise<{ automated: boolean }> {
    const adapter = this.getAdapter(method);
    if (!isRefundable(adapter)) {
      return { automated: false };
    }
    await this.processRefund(orderId, amount, method);
    return { automated: true };
  }

  private getAdapter(method: string): IPaymentAdapter {
    const adapter = this.adapterMap.get(method?.toUpperCase());
    if (!adapter) {
      throw new NotFoundException(`No payment adapter found for method: ${method}`);
    }
    return adapter;
  }
}
