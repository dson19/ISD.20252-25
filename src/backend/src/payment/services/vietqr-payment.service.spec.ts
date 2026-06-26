import { VietqrPaymentService } from './vietqr-payment.service';

describe('VietqrPaymentService (adapter cổng thuần)', () => {
  it('handleCallback trả changed=true + ids, KHÔNG đụng PaymentTransaction/Order/publish', async () => {
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

    const service = new VietqrPaymentService(vietqrRepository as never, {} as never);

    const result = await service.handleCallback({
      bankaccount: '123',
      amount: 130000,
      transType: 'C',
      content: 'AIMS 123',
      transactionid: 'BANK-TX-1',
      transactiontime: Date.now(),
      referencenumber: 'REF-1',
      orderId: '123',
    });

    expect(result.changed).toBe(true);
    expect(result.paymentTransactionId).toBe(88);
    expect(result.orderId).toBe(123);
  });

  it('handleCallback trả changed=false khi đã PAID (idempotent)', async () => {
    const vietqrRepository = {
      findByTransactionRefId: jest.fn().mockResolvedValue({
        vietqrTransactionID: 5,
        orderId: 123,
        amount: 130000,
        content: 'AIMS 123',
        transactionRefId: 'REF-1',
        status: 'PAID',
        paymentTransaction: { transactionID: 88 },
      }),
      markPaidIfPending: jest.fn(),
    };

    const service = new VietqrPaymentService(vietqrRepository as never, {} as never);

    const result = await service.handleCallback({
      bankaccount: '123',
      amount: 130000,
      transType: 'C',
      content: 'AIMS 123',
      transactionid: 'BANK-TX-1',
      transactiontime: Date.now(),
      referencenumber: 'REF-1',
      orderId: '123',
    });

    expect(result.changed).toBe(false);
    expect(vietqrRepository.markPaidIfPending).not.toHaveBeenCalled();
  });
});
