import { VietqrPaymentService } from './vietqr-payment.service';

describe('VietqrPaymentService notifications', () => {
  it('publishes one payment success event when callback marks payment paid', async () => {
    const orderRepository = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    const paymentRepository = {
      updateTransactionStatusIfCurrent: jest.fn().mockResolvedValue(true),
    };
    const vietqrRepository = {
      findByTransactionRefId: jest.fn().mockResolvedValue({
        vietqrTransactionID: 5,
        orderId: 123,
        amount: 130000,
        content: 'AIMS 123',
        transactionRefId: 'REF-1',
        status: 'PENDING',
        paymentTransaction: { transactionID: 88 },
      }),
      markPaidIfPending: jest.fn().mockResolvedValue(true),
    };
    const eventBus = {
      publish: jest.fn(),
    };
    const service = new VietqrPaymentService(
      orderRepository as never,
      paymentRepository as never,
      vietqrRepository as never,
      {} as never,
      eventBus as never,
    );

    await service.handleCallback({
      bankaccount: '123',
      amount: 130000,
      transType: 'C',
      content: 'AIMS 123',
      transactionid: 'BANK-TX-1',
      transactiontime: Date.now(),
      referencenumber: 'REF-1',
      orderId: '123',
    });

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith({
      type: 'ORDER_PAYMENT_SUCCEEDED',
      orderId: 123,
      paymentTransactionId: 88,
    });
  });
});
