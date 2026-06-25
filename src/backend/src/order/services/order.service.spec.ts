import { BadRequestException } from '@nestjs/common';
import { Product } from '../../product/entities/product.entity';
import { OrderService } from './order.service';

describe('OrderService cancellation notifications', () => {
  it('rejects cancellation for approved orders', async () => {
    const { dataSource, orderRepository } = buildDeps({
      order: buildOrder('APPROVED'),
      paymentInfo: null,
    });
    const service = buildService(dataSource, orderRepository);

    await expect(service.cancelOrder(123)).rejects.toThrow(BadRequestException);
  });

  it('publishes refund-pending cancellation notification for paid VietQR orders', async () => {
    const eventBus = { publish: jest.fn() };
    const { dataSource, orderRepository } = buildDeps({
      order: buildOrder('PENDING_PROCESSING'),
      paymentInfo: { transaction_id: 88, method: 'VIETQR' },
    });
    const service = buildService(dataSource, orderRepository, eventBus);

    await service.cancelOrder(123);

    expect(eventBus.publish).toHaveBeenCalledWith({
      type: 'ORDER_CANCELLED',
      orderId: 123,
      paymentTransactionId: 88,
      refundMethod: 'VIETQR',
      refundStatus: 'REFUND_PENDING',
    });
  });

  it('refunds PayPal and publishes refunded cancellation notification', async () => {
    const eventBus = { publish: jest.fn() };
    const paymentService = {
      processRefundIfSupported: jest.fn().mockResolvedValue({ automated: true }),
    };
    const { dataSource, orderRepository } = buildDeps({
      order: buildOrder('PENDING_PROCESSING'),
      paymentInfo: { transaction_id: 99, method: 'PAYPAL' },
    });
    const service = buildService(dataSource, orderRepository, eventBus, paymentService);

    await service.cancelOrder(123);

    expect(paymentService.processRefundIfSupported).toHaveBeenCalledWith(123, 100000, 'PAYPAL');
    expect(eventBus.publish).toHaveBeenCalledWith({
      type: 'ORDER_CANCELLED',
      orderId: 123,
      paymentTransactionId: 99,
      refundMethod: 'PAYPAL',
      refundStatus: 'REFUNDED',
    });
  });
});

function buildService(
  dataSource: any,
  orderRepository: any,
  eventBus = { publish: jest.fn() },
  paymentService: any = { processRefundIfSupported: jest.fn().mockResolvedValue({ automated: false }) },
) {
  return new OrderService(
    dataSource,
    orderRepository,
    {} as never, // cartService
    {} as never, // shippingCalculatorService
    eventBus as never,
    paymentService as never,
  );
}

function buildDeps({ order, paymentInfo }: { order: any; paymentInfo: any }) {
  const manager = {
    findOne: jest.fn((entity) => {
      if (entity === Product) {
        return Promise.resolve({ productID: 1, quantityInStock: 1 });
      }
      return Promise.resolve(null);
    }),
    save: jest.fn((_, entity) => Promise.resolve(entity)),
  };

  const dataSource = {
    manager,
    transaction: jest.fn((callback) => callback(manager)),
  };

  // OrderRepository transaction-aware: data access đi qua repo, không phải raw SQL trong service.
  const orderRepository = {
    findFullById: jest.fn().mockResolvedValue(order),
    getSuccessfulPaymentInfo: jest.fn().mockResolvedValue(paymentInfo),
    save: jest.fn((entity) => Promise.resolve(entity)),
  };

  return { dataSource, orderRepository };
}

function buildOrder(status: string) {
  return {
    orderID: 123,
    status,
    totalPayment: 100000,
    orderItems: [
      {
        quantity: 1,
        product: { productID: 1 },
      },
    ],
  };
}
