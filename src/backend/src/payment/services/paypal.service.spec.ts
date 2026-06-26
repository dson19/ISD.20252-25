import { PaypalService } from './paypal.service';

describe('PaypalService (adapter cổng thuần)', () => {
  it('captureOrder trả kết quả chuẩn hoá, KHÔNG đụng PaymentTransaction/Order/publish', async () => {
    const paypalRepository = {
      updatePaypalTx: jest.fn().mockResolvedValue(undefined),
      findByPaypalOrderId: jest.fn().mockResolvedValue({
        paymentTransaction: { transactionID: 77 },
      }),
    };
    const paypalApiClient = {
      captureOrder: jest.fn().mockResolvedValue({
        status: 'COMPLETED',
        purchase_units: [{ payments: { captures: [{ id: 'CAPTURE-1' }] } }],
      }),
    };

    const service = new PaypalService(paypalRepository as never, paypalApiClient as never);

    const result = await service.captureOrder('PAYPAL-1', 123);

    expect(result.completed).toBe(true);
    expect(result.paymentTransactionId).toBe(77);
    expect(paypalRepository.updatePaypalTx).toHaveBeenCalledWith('PAYPAL-1', {
      paypalCaptureID: 'CAPTURE-1',
      status: 'COMPLETED',
    });
  });

  it('captureOrder báo completed=false khi cổng chưa COMPLETED', async () => {
    const paypalRepository = {
      updatePaypalTx: jest.fn(),
      findByPaypalOrderId: jest.fn(),
    };
    const paypalApiClient = {
      captureOrder: jest.fn().mockResolvedValue({ status: 'PENDING' }),
    };

    const service = new PaypalService(paypalRepository as never, paypalApiClient as never);

    const result = await service.captureOrder('PAYPAL-1', 123);

    expect(result.completed).toBe(false);
    expect(result.paymentTransactionId).toBeNull();
    expect(paypalRepository.updatePaypalTx).not.toHaveBeenCalled();
  });
});
