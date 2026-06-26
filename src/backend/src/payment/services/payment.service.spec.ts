import { PaymentService } from './payment.service';

/**
 * PaymentService là owner của PaymentTransaction + điểm publish duy nhất. Hệ quả "payment succeeded"
 * (mark tx SUCCESS + order PENDING_PROCESSING + publish) gom ở onPaymentConfirmed, dùng chung cho
 * cả PayPal capture (chủ động) lẫn VietQR callback (bị động).
 */
describe('PaymentService - onPaymentConfirmed dùng chung', () => {
  function makeDeps() {
    return {
      dataSource: {} as never,
      paymentRepository: {
        updateTransactionStatusIfCurrent: jest.fn().mockResolvedValue(true),
        updateTransactionStatus: jest.fn().mockResolvedValue(undefined),
        findTransactionByOrderId: jest.fn(),
        createTransaction: jest.fn(),
      },
      orderRepository: {
        updateStatus: jest.fn().mockResolvedValue(undefined),
      },
      eventBus: { publish: jest.fn() },
    };
  }

  it('capture thành công → 1 event + mark tx SUCCESS + order PENDING_PROCESSING', async () => {
    const d = makeDeps();
    const creditCard = {
      method: 'PAYPAL',
      captureOrder: jest.fn().mockResolvedValue({ completed: true, paymentTransactionId: 77, raw: { ok: 1 } }),
    };
    const service = new PaymentService(
      d.dataSource, d.paymentRepository as never, d.orderRepository as never,
      d.eventBus as never, creditCard as never, {} as never,
    );

    const raw = await service.captureCreditCardOrder('PAYPAL-1', 123);

    expect(raw).toEqual({ ok: 1 });
    expect(d.paymentRepository.updateTransactionStatusIfCurrent).toHaveBeenCalledWith(77, 'PENDING', 'SUCCESS');
    expect(d.orderRepository.updateStatus).toHaveBeenCalledWith(123, 'PENDING_PROCESSING');
    expect(d.eventBus.publish).toHaveBeenCalledTimes(1);
    expect(d.eventBus.publish).toHaveBeenCalledWith({ type: 'ORDER_PAYMENT_SUCCEEDED', orderId: 123, paymentTransactionId: 77 });
  });

  it('callback changed → 1 event qua cùng onPaymentConfirmed', async () => {
    const d = makeDeps();
    const qrCode = {
      method: 'VIETQR',
      handleCallback: jest.fn().mockResolvedValue({ changed: true, paymentTransactionId: 88, orderId: 123, message: 'Callback processed' }),
    };
    const service = new PaymentService(
      d.dataSource, d.paymentRepository as never, d.orderRepository as never,
      d.eventBus as never, {} as never, qrCode as never,
    );

    const res = await service.handleQrCallback({} as never);

    expect(res).toEqual({ status: 'SUCCESS', message: 'Callback processed', paymentId: 88 });
    expect(d.orderRepository.updateStatus).toHaveBeenCalledWith(123, 'PENDING_PROCESSING');
    expect(d.eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('callback không đổi (idempotent) → KHÔNG publish, KHÔNG đụng order', async () => {
    const d = makeDeps();
    const qrCode = {
      method: 'VIETQR',
      handleCallback: jest.fn().mockResolvedValue({ changed: false, paymentTransactionId: 88, orderId: 123, message: 'Callback already processed' }),
    };
    const service = new PaymentService(
      d.dataSource, d.paymentRepository as never, d.orderRepository as never,
      d.eventBus as never, {} as never, qrCode as never,
    );

    await service.handleQrCallback({} as never);

    expect(d.eventBus.publish).not.toHaveBeenCalled();
    expect(d.orderRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('processRefundIfSupported: QR không refund tự động → automated=false', async () => {
    const d = makeDeps();
    const creditCard = { method: 'PAYPAL', refund: jest.fn() };
    const service = new PaymentService(
      d.dataSource, d.paymentRepository as never, d.orderRepository as never,
      d.eventBus as never, creditCard as never, { method: 'VIETQR' } as never,
    );

    const result = await service.processRefundIfSupported(123, 130000, 'VIETQR');

    expect(result).toEqual({ automated: false });
    expect(creditCard.refund).not.toHaveBeenCalled();
  });

  it('processRefundIfSupported: thẻ tín dụng → refund + mark REFUNDED + automated=true', async () => {
    const d = makeDeps();
    d.paymentRepository.findTransactionByOrderId.mockResolvedValue({ transactionID: 99 });
    const creditCard = { method: 'PAYPAL', refund: jest.fn().mockResolvedValue({ ok: 1 }) };
    const service = new PaymentService(
      d.dataSource, d.paymentRepository as never, d.orderRepository as never,
      d.eventBus as never, creditCard as never, { method: 'VIETQR' } as never,
    );

    const result = await service.processRefundIfSupported(123, 130000, 'PAYPAL');

    expect(result).toEqual({ automated: true });
    expect(creditCard.refund).toHaveBeenCalledWith(123);
    expect(d.paymentRepository.updateTransactionStatus).toHaveBeenCalledWith(99, 'REFUNDED');
  });
});
