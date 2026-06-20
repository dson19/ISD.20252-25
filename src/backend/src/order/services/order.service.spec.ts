import { BadRequestException } from '@nestjs/common';
import { Order } from '../entities/order.entity';
import { Product } from '../../product/entities/product.entity';
import { OrderService } from './order.service';

describe('OrderService cancellation notifications', () => {
  it('rejects cancellation for approved orders', async () => {
    const dataSource = buildDataSource({
      order: buildOrder('APPROVED'),
      paymentRows: [],
    });
    const service = buildService(dataSource);

    await expect(service.cancelOrder(123)).rejects.toThrow(BadRequestException);
  });

  it('publishes refund-pending cancellation notification for paid VietQR orders', async () => {
    const eventBus = { publish: jest.fn() };
    const dataSource = buildDataSource({
      order: buildOrder('PENDING_PROCESSING'),
      paymentRows: [{ transaction_id: 88, method: 'VIETQR' }],
    });
    const service = buildService(dataSource, eventBus);

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
    const dataSource = buildDataSource({
      order: buildOrder('PENDING_PROCESSING'),
      paymentRows: [{ transaction_id: 99, method: 'PAYPAL' }],
    });
    const service = buildService(dataSource, eventBus, paymentService);

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
  eventBus = { publish: jest.fn() },
  paymentService: any = { processRefundIfSupported: jest.fn().mockResolvedValue({ automated: false }) },
) {
  return new OrderService(
    dataSource,
    {} as never,
    {} as never,
    {} as never,
    eventBus as never,
    paymentService as never,
  );
}

function buildDataSource({ order, paymentRows }: { order: any; paymentRows: any[] }) {
  const manager = {
    findOne: jest.fn((entity) => {
      if (entity === Order) {
        return Promise.resolve(order);
      }
      if (entity === Product) {
        return Promise.resolve({ productID: 1, quantityInStock: 1 });
      }
      return Promise.resolve(null);
    }),
    query: jest.fn().mockResolvedValue(paymentRows),
    save: jest.fn((_, entity) => Promise.resolve(entity)),
  };

  return {
    manager,
    transaction: jest.fn((callback) => callback(manager)),
  };
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
