import { Order } from '../order/entities/order.entity';
import { PaymentTransaction } from '../payment/entities/payment-transaction.entity';
import { NotificationEventBus } from './events/notification-event-bus';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  it('logs provider failures without throwing', async () => {
    const provider = {
      channel: 'EMAIL' as const,
      send: jest.fn().mockRejectedValue(new Error('SendGrid unavailable')),
    };
    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Order) {
          return {
            findOne: jest.fn().mockResolvedValue(buildOrder()),
          };
        }
        if (entity === PaymentTransaction) {
          return {
            findOne: jest.fn().mockResolvedValue({
              transactionID: 10,
              transactionContent: 'AIMS 1',
              createdAt: new Date(),
            }),
          };
        }
        return { findOne: jest.fn() };
      }),
    };
    const service = new NotificationService(
      dataSource as never,
      new NotificationEventBus(),
      [provider],
    );

    await expect(
      service.handle({
        type: 'ORDER_PAYMENT_SUCCEEDED',
        orderId: 1,
        paymentTransactionId: 10,
      }),
    ).resolves.toBeUndefined();
    expect(provider.send).toHaveBeenCalledTimes(1);
  });
});

function buildOrder() {
  return {
    orderID: 1,
    totalPayment: 100000,
    subTotal: 80000,
    tax: 8000,
    shippingFee: 12000,
    customerAccessToken: 'token',
    deliveryInfo: {
      email: 'customer@example.com',
      receiverName: 'Nguyen Van A',
      phoneNumber: '0901234567',
      address: '1 Le Loi',
      province: 'Ha Noi',
    },
    invoice: {
      invoiceID: 1,
      totalExcludeVAT: 80000,
      totalIncludeVAT: 88000,
      shippingFee: 12000,
      totalPayment: 100000,
    },
  };
}
