import { PaypalService } from './paypal.service';

describe('PaypalService notifications', () => {
  it('publishes one payment success event after successful capture', async () => {
    const paymentRepository = {
      updateTransactionStatus: jest.fn().mockResolvedValue(undefined),
    };
    const paypalRepository = {
      updatePaypalTx: jest.fn().mockResolvedValue(undefined),
      findByPaypalOrderId: jest.fn().mockResolvedValue({
        paymentTransaction: { transactionID: 77 },
      }),
    };
    const orderRepository = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const paypalApiClient = {
      captureOrder: jest.fn().mockResolvedValue({
        status: 'COMPLETED',
        purchase_units: [{ payments: { captures: [{ id: 'CAPTURE-1' }] } }],
      }),
    };
    const eventBus = {
      publish: jest.fn(),
    };
    const service = new PaypalService(
      paymentRepository as never,
      paypalRepository as never,
      orderRepository as never,
      paypalApiClient as never,
      eventBus as never,
    );

    await service.captureOrderInPaypal('PAYPAL-1', 123);

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith({
      type: 'ORDER_PAYMENT_SUCCEEDED',
      orderId: 123,
      paymentTransactionId: 77,
    });
  });
});
