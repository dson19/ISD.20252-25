import { BadRequestException } from '@nestjs/common';
import { PaymentRepository } from './payment.repository';
import { VietqrApiClient } from './vietqr-api.client';
import { VietqrPaymentService } from './vietqr-payment.service';
import { VietqrRepository } from './vietqr.repository';

describe('VietqrPaymentService', () => {
  let service: VietqrPaymentService;
  let paymentRepository: jest.Mocked<Pick<PaymentRepository, 'createTransaction' | 'updateTransactionStatusIfCurrent'>>;
  let vietqrRepository: jest.Mocked<
    Pick<
      VietqrRepository,
      | 'createVietqrTransaction'
      | 'findByPaymentTransactionId'
      | 'findByTransactionRefId'
      | 'findByContent'
      | 'markExpired'
      | 'markPaidIfPending'
    >
  >;
  let vietqrApiClient: jest.Mocked<Pick<VietqrApiClient, 'generateQrCode'>>;

  beforeEach(() => {
    paymentRepository = {
      createTransaction: jest.fn(),
      updateTransactionStatusIfCurrent: jest.fn(),
    };
    vietqrRepository = {
      createVietqrTransaction: jest.fn(),
      findByPaymentTransactionId: jest.fn(),
      findByTransactionRefId: jest.fn(),
      findByContent: jest.fn(),
      markExpired: jest.fn(),
      markPaidIfPending: jest.fn(),
    };
    vietqrApiClient = {
      generateQrCode: jest.fn(),
    };

    service = new VietqrPaymentService(
      paymentRepository as unknown as PaymentRepository,
      vietqrRepository as unknown as VietqrRepository,
      vietqrApiClient as unknown as VietqrApiClient,
    );
  });

  it('creates a VietQR payment successfully', async () => {
    const expiredAt = new Date(Date.now() + 15 * 60 * 1000);
    paymentRepository.createTransaction.mockResolvedValue({ transactionID: 9 } as any);
    vietqrApiClient.generateQrCode.mockResolvedValue({
      qrCode: 'QR_DATA',
      qrLink: 'https://qr.example/9',
      transactionId: 'TX9',
      transactionRefId: 'REF9',
      orderId: '12',
    });
    vietqrRepository.createVietqrTransaction.mockResolvedValue({
      paymentTransaction: { transactionID: 9 },
      orderId: 12,
      amount: 50000,
      content: 'AIMS12P9',
      qrCode: 'QR_DATA',
      qrLink: 'https://qr.example/9',
      transactionRefId: 'REF9',
      expiredAt,
      status: 'PENDING',
    } as any);

    const result = await service.createPayment({ orderId: 12, amount: 50000 });

    expect(paymentRepository.createTransaction).toHaveBeenCalledWith(12, 50000, 'VIETQR');
    expect(vietqrApiClient.generateQrCode).toHaveBeenCalledWith({
      orderId: '12',
      amount: 50000,
      content: 'AIMS12P9',
    });
    expect(result).toMatchObject({
      paymentId: 9,
      orderId: 12,
      amount: 50000,
      transactionRef: 'REF9',
      paymentContent: 'AIMS12P9',
      qrCode: 'QR_DATA',
      qrLink: 'https://qr.example/9',
      status: 'PENDING',
    });
  });

  it('rejects invalid payment amount before creating records', async () => {
    await expect(service.createPayment({ orderId: 12, amount: 0 })).rejects.toBeInstanceOf(BadRequestException);
    expect(paymentRepository.createTransaction).not.toHaveBeenCalled();
  });

  it('marks a pending VietQR payment as paid on successful callback', async () => {
    vietqrRepository.findByTransactionRefId.mockResolvedValue({
      vietqrTransactionID: 3,
      paymentTransaction: { transactionID: 9 },
      orderId: 12,
      amount: 50000,
      content: 'AIMS12P9',
      status: 'PENDING',
    } as any);
    vietqrRepository.markPaidIfPending.mockResolvedValue(true);
    paymentRepository.updateTransactionStatusIfCurrent.mockResolvedValue(true);

    const result = await service.handleCallback({
      bankaccount: '123456',
      amount: 50000,
      transType: 'C',
      content: 'AIMS12P9',
      transactionid: 'TX9',
      transactiontime: 1760000000000,
      referencenumber: 'REF9',
      orderId: '12',
    });

    expect(vietqrRepository.markPaidIfPending).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        transactionId: 'TX9',
        transactionRefId: 'REF9',
      }),
    );
    expect(paymentRepository.updateTransactionStatusIfCurrent).toHaveBeenCalledWith(9, 'PENDING', 'SUCCESS');
    expect(result).toEqual({
      status: 'SUCCESS',
      message: 'Callback processed',
      paymentId: 9,
    });
  });

  it('handles duplicate successful callback idempotently', async () => {
    vietqrRepository.findByTransactionRefId.mockResolvedValue({
      vietqrTransactionID: 3,
      paymentTransaction: { transactionID: 9 },
      orderId: 12,
      amount: 50000,
      content: 'AIMS12P9',
      status: 'PAID',
    } as any);

    const result = await service.handleCallback({
      bankaccount: '123456',
      amount: 50000,
      transType: 'C',
      content: 'AIMS12P9',
      transactionid: 'TX9',
      transactiontime: 1760000000000,
      referencenumber: 'REF9',
      orderId: '12',
    });

    expect(vietqrRepository.markPaidIfPending).not.toHaveBeenCalled();
    expect(paymentRepository.updateTransactionStatusIfCurrent).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'SUCCESS',
      message: 'Callback already processed',
      paymentId: 9,
    });
  });

  it('expires a pending payment during status check', async () => {
    vietqrRepository.findByPaymentTransactionId.mockResolvedValue({
      vietqrTransactionID: 3,
      paymentTransaction: { transactionID: 9 },
      orderId: 12,
      amount: 50000,
      content: 'AIMS12P9',
      qrCode: 'QR_DATA',
      qrLink: 'https://qr.example/9',
      transactionRefId: 'REF9',
      expiredAt: new Date(Date.now() - 1000),
      status: 'PENDING',
    } as any);
    paymentRepository.updateTransactionStatusIfCurrent.mockResolvedValue(true);

    const result = await service.getStatusByPaymentId(9);

    expect(vietqrRepository.markExpired).toHaveBeenCalledWith(3);
    expect(paymentRepository.updateTransactionStatusIfCurrent).toHaveBeenCalledWith(9, 'PENDING', 'FAILED');
    expect(result.status).toBe('EXPIRED');
  });
});
