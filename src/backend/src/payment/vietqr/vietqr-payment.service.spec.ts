import { Test, TestingModule } from '@nestjs/testing';
import {
  InvalidTokenException,
  MissingTokenException,
  PaymentGatewayException,
  TransactionNotFoundException,
  TokenExpiredException,
} from '../exceptions/exceptions';
import { PaymentTransaction } from './domain/payment-transaction';
import { QRCode } from './domain/qr-code';
import { QRGenerateRequest } from './domain/qr-generate-request';
import { InvalidAmountException } from './exceptions/vietqr.exceptions';
import {
  PAYMENT_TRANSACTION_REPOSITORY,
  PaymentTransactionRepository,
} from './payment-transaction.repository';
import { VIETQR_API_CLIENT, VietQRApiClient } from './vietqr-api-client';
import { VietQRPaymentService } from './vietqr-payment.service';
import { VietQRService } from './vietqr.service';

describe('VietQR payment module', () => {
  let paymentService: VietQRPaymentService;
  let vietQRService: VietQRService;
  let transactionRepository: jest.Mocked<PaymentTransactionRepository>;
  let apiClient: jest.Mocked<VietQRApiClient>;

  beforeEach(async () => {
    transactionRepository = {
      findLatestByStatus: jest.fn(),
      save: jest.fn((transaction) => Promise.resolve(transaction)),
    };
    apiClient = {
      getAccessToken: jest.fn(),
      generateQRCode: jest.fn(),
      checkPaymentStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VietQRPaymentService,
        VietQRService,
        {
          provide: PAYMENT_TRANSACTION_REPOSITORY,
          useValue: transactionRepository,
        },
        {
          provide: VIETQR_API_CLIENT,
          useValue: apiClient,
        },
      ],
    }).compile();

    paymentService = module.get(VietQRPaymentService);
    vietQRService = module.get(VietQRService);
  });

  describe('VietQRPaymentService.createTransaction', () => {
    it('M_TC01 CreateTransactionSuccess', async () => {
      const result = await paymentService.createTransaction(1, 200000, 'VietQR');

      expect(result).toMatchObject({
        invoiceId: 1,
        amount: 200000,
        method: 'VietQR',
        status: 'PENDING',
      });
      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: 1,
          amount: 200000,
          method: 'VietQR',
          status: 'PENDING',
        }),
      );
    });

    it('M_TC02 CreateTransactionMinBound', async () => {
      const result = await paymentService.createTransaction(1, 1, 'VietQR');

      expect(result.amount).toBe(1);
      expect(result.status).toBe('PENDING');
    });

    it('M_TC03 CreateTransactionInvalidAmountError', async () => {
      await expect(
        paymentService.createTransaction(1, 0, 'VietQR'),
      ).rejects.toThrow(InvalidAmountException);
    });
  });

  describe('VietQRService.generateQRCode', () => {
    it('M_TC04 GenerateQRSuccess', async () => {
      apiClient.generateQRCode.mockResolvedValue({
        qrLink: 'https://vietqr.test/qr/ORDER-200000.png',
      });

      const result = await vietQRService.generateQRCode(
        200000,
        'VALID_JWT_TOKEN',
      );

      expect(result).toBe('https://vietqr.test/qr/ORDER-200000.png');
      expect(apiClient.generateQRCode).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 200000 }),
        'VALID_JWT_TOKEN',
      );
    });

    it('M_TC05 GenerateQRGatewayError', async () => {
      apiClient.generateQRCode.mockRejectedValue(new Error('timeout'));

      await expect(
        vietQRService.generateQRCode(200000, 'VALID_JWT_TOKEN'),
      ).rejects.toThrow(PaymentGatewayException);
    });

    it('M_TC06 GenerateQRExpiredTokenError', async () => {
      await expect(
        vietQRService.generateQRCode(200000, 'EXPIRED_JWT_TOKEN'),
      ).rejects.toThrow(TokenExpiredException);
    });

    it('M_TC07 GenerateQRInvalidTokenError', async () => {
      await expect(
        vietQRService.generateQRCode(200000, 'INVALID_SIGNATURE_TOKEN'),
      ).rejects.toThrow(InvalidTokenException);
    });

    it('M_TC08 GenerateQRMissingTokenError', async () => {
      await expect(vietQRService.generateQRCode(200000, '')).rejects.toThrow(
        MissingTokenException,
      );
    });
  });

  describe('VietQRPaymentService.processPaymentResult', () => {
    it('M_TC09 ProcessPaymentCallbackSuccess', async () => {
      const pendingTransaction = PaymentTransaction.create(1, 200000, 'VietQR');
      transactionRepository.findLatestByStatus.mockResolvedValue(
        pendingTransaction,
      );

      const result = await paymentService.processPaymentResult(
        'SUCCESS',
        'PENDING',
      );

      expect(result).toMatchObject({
        invoiceId: 1,
        amount: 200000,
        method: 'VietQR',
        status: 'SUCCESS',
      });
      expect(transactionRepository.findLatestByStatus).toHaveBeenCalledWith(
        'PENDING',
      );
      expect(transactionRepository.save).toHaveBeenCalledWith(
        pendingTransaction,
      );
    });

    it('M_TC10 ProcessPaymentCallbackFailed', async () => {
      const pendingTransaction = PaymentTransaction.create(1, 200000, 'VietQR');
      transactionRepository.findLatestByStatus.mockResolvedValue(
        pendingTransaction,
      );

      const result = await paymentService.processPaymentResult(
        'FAILED',
        'PENDING',
      );

      expect(result).toMatchObject({
        invoiceId: 1,
        amount: 200000,
        method: 'VietQR',
        status: 'FAILED',
      });
      expect(transactionRepository.findLatestByStatus).toHaveBeenCalledWith(
        'PENDING',
      );
      expect(transactionRepository.save).toHaveBeenCalledWith(
        pendingTransaction,
      );
    });

    it('M_TC11ProcessPaymentCallbackTransactionNotFound', async () => {
      transactionRepository.findLatestByStatus.mockResolvedValue(null);

      await expect(
        paymentService.processPaymentResult('SUCCESS', 'PENDING'),
      ).rejects.toThrow(TransactionNotFoundException);
      expect(transactionRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('QRCode domain', () => {
    it('M_TC12 QRCode domain', () => {
      const qrCode = QRCode.parseQRCodeResponse({
        qrLink: 'https://vietqr.test/qr.png',
        qrCode: '000201',
        amount: 200000,
      });

      expect(qrCode).toMatchObject({
        qrLink: 'https://vietqr.test/qr.png',
        qrCode: '000201',
        amount: 200000,
      });
    });

    it('M_TC13 QRCode domain malformed response', () => {
      expect(() => QRCode.parseQRCodeResponse({ data: {} })).toThrow(
        'QR code response is missing QR link',
      );
    });
  });

  describe('QRGenerateRequest domain', () => {
    it('M_TC14 QRGenerateRequestSuccess', () => {
      const request = new QRGenerateRequest(
        'payment:200000',
        200000,
        'ORDER-200000',
        '970436',
        '1234567890',
        'Vietcombank',
      );

      expect(JSON.parse(request.buildRequestString())).toMatchObject({
        content: 'payment:200000',
        amount: 200000,
        orderId: 'ORDER-200000',
        bankCode: '970436',
        bankAccount: '1234567890',
        bankName: 'Vietcombank',
      });
    });
  });

});
