import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import {
  MissingTokenException,
  TokenExpiredException,
  InvalidTokenException,
  InvalidInvoiceException,
  InvalidPriceException,
  TransactionNotFoundException,
  PaymentGatewayException,
  PayPalRefundException,
} from './exceptions/exceptions';

describe('PaymentService', () => {
  let service: PaymentService;
  let httpServiceMock: any;
  let paypalRepoMock: any;
  let orderRepoMock: any;

  beforeEach(async () => {
    httpServiceMock = { post: jest.fn() };
    paypalRepoMock = { findOne: jest.fn(), save: jest.fn() };
    orderRepoMock = { updateStatus: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: 'HttpService', useValue: httpServiceMock },
        { provide: 'PaypalTransactionRepository', useValue: paypalRepoMock },
        { provide: 'OrderRepository', useValue: orderRepoMock },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('payThroughGatewayService - Access Token Security Layer', () => {
    it('nên ném lỗi MissingTokenException khi thiếu token hoặc token rỗng', async () => {
      await expect(
        service.payThroughGatewayService('PAYPAL_CREATE', { invoiceID: 'INV-123', totalPayment: 100 }, '')
      ).rejects.toThrow(MissingTokenException);
    });

    it('nên ném lỗi TokenExpiredException khi truyền token hết hạn', async () => {
      await expect(
        service.payThroughGatewayService('PAYPAL_CREATE', { invoiceID: 'INV-123', totalPayment: 100 }, 'EXPIRED_JWT_TOKEN')
      ).rejects.toThrow(TokenExpiredException);
    });

    it('nên ném lỗi InvalidTokenException khi truyền token sai chữ ký/hỏng', async () => {
      await expect(
        service.payThroughGatewayService('PAYPAL_CREATE', { invoiceID: 'INV-123', totalPayment: 100 }, 'INVALID_SIGNATURE_TOKEN')
      ).rejects.toThrow(InvalidTokenException);
    });
    it('nên cho qua và không ném lỗi bảo mật khi truyền token hoàn toàn hợp lệ', async () => {
      const payload = { invoiceID: 'INV-123', totalPayment: 150 };
      
      httpServiceMock.post.mockResolvedValue({
        data: { links: [{ rel: 'approve', href: 'https://paypal.com/approve/123' }] }
      });

      await expect(
        service.payThroughGatewayService('PAYPAL_CREATE', payload, 'VALID_JWT_TOKEN')
      ).resolves.not.toThrow(MissingTokenException);

      await expect(
        service.payThroughGatewayService('PAYPAL_CREATE', payload, 'VALID_JWT_TOKEN')
      ).resolves.not.toThrow(TokenExpiredException);
    });
  });

  describe('payThroughGatewayService - Business Validation Tests', () => {
    const validToken = 'VALID_JWT_TOKEN';

    describe('PAYPAL_CREATE', () => {
      it('nên ném lỗi khi thiếu TẤT CẢ các tham số (payload rỗng)', async () => {
        await expect(
          service.payThroughGatewayService('PAYPAL_CREATE', {}, validToken)
        ).rejects.toThrow(InvalidInvoiceException);
      });

      it('nên ném lỗi khi chỉ thiếu mỗi totalPayment', async () => {
        const payload = { invoiceID: 'INV-123' };
        await expect(
          service.payThroughGatewayService('PAYPAL_CREATE', payload, validToken)
        ).rejects.toThrow(InvalidInvoiceException);
      });

      it('nên ném lỗi khi chỉ thiếu mỗi invoiceID', async () => {
        const payload = { totalPayment: 100 };
        await expect(
          service.payThroughGatewayService('PAYPAL_CREATE', payload, validToken)
        ).rejects.toThrow(InvalidInvoiceException);
      });

      it('nên ném lỗi khi totalPayment bằng 0 (Mốc biên invalid)', async () => {
        const payload = { invoiceID: 'INV-123', totalPayment: 0 };
        await expect(
          service.payThroughGatewayService('PAYPAL_CREATE', payload, validToken)
        ).rejects.toThrow(InvalidPriceException);
      });

      it('nên ném lỗi khi totalPayment âm (Phân vùng giá trị invalid)', async () => {
        const payload = { invoiceID: 'INV-123', totalPayment: -50 };
        await expect(
          service.payThroughGatewayService('PAYPAL_CREATE', payload, validToken)
        ).rejects.toThrow(InvalidPriceException);
      });

      it('nên chạy thành công và trả về link approve khi đủ tham số hợp lệ', async () => {
        const payload = { invoiceID: 'INV-123', totalPayment: 150 };
        httpServiceMock.post.mockResolvedValue({
          data: {
            links: [{ rel: 'approve', href: 'https://paypal.com/approve/123' }]
          }
        });

        const result = await service.payThroughGatewayService('PAYPAL_CREATE', payload, validToken);
        expect(result).toBe('https://paypal.com/approve/123');
        expect(httpServiceMock.post).toHaveBeenCalled();
      });
    });

    describe('PAYPAL_CAPTURE', () => {
      it('nên ném lỗi khi thiếu TẤT CẢ các tham số (payload rỗng)', async () => {
        await expect(
          service.payThroughGatewayService('PAYPAL_CAPTURE', {}, validToken)
        ).rejects.toThrow(InvalidInvoiceException);
      });

      it('nên ném lỗi khi chỉ thiếu mỗi captureStatus', async () => {
        const payload = { payPalOrderID: 'PP-789' };
        await expect(
          service.payThroughGatewayService('PAYPAL_CAPTURE', payload, validToken)
        ).rejects.toThrow(InvalidInvoiceException);
      });

      it('nên ném lỗi khi chỉ thiếu mỗi payPalOrderID', async () => {
        const payload = { captureStatus: 'COMPLETED' };
        await expect(
          service.payThroughGatewayService('PAYPAL_CAPTURE', payload, validToken)
        ).rejects.toThrow(InvalidInvoiceException);
      });

      it('nên ném lỗi TransactionNotFoundException khi không tìm thấy transaction trong database', async () => {
        const payload = { payPalOrderID: 'NOT_FOUND', captureStatus: 'COMPLETED' };
        paypalRepoMock.findOne.mockResolvedValue(null);

        await expect(
          service.payThroughGatewayService('PAYPAL_CAPTURE', payload, validToken)
        ).rejects.toThrow(TransactionNotFoundException);
      });

      it('nên cập nhật trạng thái đơn hàng thành PAID khi capture thành công (COMPLETED)', async () => {
        const payload = { payPalOrderID: 'PP-789', captureStatus: 'COMPLETED' };
        const mockTransaction = { payPalOrderID: 'PP-789', status: 'PENDING' };
        paypalRepoMock.findOne.mockResolvedValue(mockTransaction);

        const result = await service.payThroughGatewayService('PAYPAL_CAPTURE', payload, validToken);
        
        expect(result).toEqual({ success: true });
        expect(paypalRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'APPROVED' }));
        expect(orderRepoMock.updateStatus).toHaveBeenCalledWith(1, 'PAID');
      });

      it('nên cập nhật trạng thái transaction thành DENIED và ném lỗi PaymentGatewayException khi trạng thái là DECLINED', async () => {
        const payload = { payPalOrderID: 'PP-789', captureStatus: 'DECLINED' };
        const mockTransaction = { payPalOrderID: 'PP-789', status: 'PENDING' };
        paypalRepoMock.findOne.mockResolvedValue(mockTransaction);

        await expect(
          service.payThroughGatewayService('PAYPAL_CAPTURE', payload, validToken)
        ).rejects.toThrow(PaymentGatewayException);
        expect(paypalRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'DENIED' }));
      });

      it('nên cập nhật trạng thái transaction thành CANCELED và ném lỗi PaymentGatewayException khi trạng thái là CANCELED', async () => {
        const payload = { payPalOrderID: 'PP-789', captureStatus: 'CANCELED' };
        const mockTransaction = { payPalOrderID: 'PP-789', status: 'PENDING' };
        paypalRepoMock.findOne.mockResolvedValue(mockTransaction);

        await expect(
          service.payThroughGatewayService('PAYPAL_CAPTURE', payload, validToken)
        ).rejects.toThrow(PaymentGatewayException);
        expect(paypalRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'CANCELED' }));
      });
    });

    describe('PAYPAL_REFUND', () => {
      it('nên ném lỗi khi thiếu tham số captureID', async () => {
        await expect(
          service.payThroughGatewayService('PAYPAL_REFUND', {}, validToken)
        ).rejects.toThrow(InvalidInvoiceException);
      });

      it('nên ném lỗi PayPalRefundException khi số tiền amount nhỏ hơn hoặc bằng 0', async () => {
        const payload = { captureID: 'CAP-123', amount: 0 };
        const mockTransaction = { captureID: 'CAP-123', totalPayment: 100 };
        paypalRepoMock.findOne.mockResolvedValue(mockTransaction);

        await expect(
          service.payThroughGatewayService('PAYPAL_REFUND', payload, validToken)
        ).rejects.toThrow(PayPalRefundException);
      });

      it('nên ném lỗi PayPalRefundException khi không tìm thấy giao dịch tương ứng với captureID trong database', async () => {
        const payload = { captureID: 'NOT_FOUND', amount: 50 };
        paypalRepoMock.findOne.mockResolvedValue(null);

        await expect(
          service.payThroughGatewayService('PAYPAL_REFUND', payload, validToken)
        ).rejects.toThrow(PayPalRefundException);
      });

      it('nên ném lỗi PayPalRefundException khi số tiền yêu cầu hoàn vượt quá hạn mức thanh toán gốc (Mốc biên trên)', async () => {
        const payload = { captureID: 'CAP-123', amount: 150 };
        const mockTransaction = { captureID: 'CAP-123', totalPayment: 100, status: 'APPROVED' };
        paypalRepoMock.findOne.mockResolvedValue(mockTransaction);

        await expect(
          service.payThroughGatewayService('PAYPAL_REFUND', payload, validToken)
        ).rejects.toThrow(PayPalRefundException);
      });

      it('nên hoàn tiền một phần thành công khi các tham số đều hợp lệ', async () => {
        const payload = { captureID: 'CAP-123', amount: 40 };
        const mockTransaction = { captureID: 'CAP-123', totalPayment: 100, status: 'APPROVED' };
        
        paypalRepoMock.findOne.mockResolvedValue(mockTransaction);
        httpServiceMock.post.mockResolvedValue({
          data: { status: 'COMPLETED', id: 'REF-111' }
        });

        const result = await service.payThroughGatewayService('PAYPAL_REFUND', payload, validToken);

        expect(result).toEqual({ success: true, refundID: 'REF-111' });
        expect(paypalRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'REFUNDED' }));
      });

      it('nên hoàn tiền toàn bộ 100% thành công khi không truyền tham số amount', async () => {
        const payload = { captureID: 'CAP-123' };
        const mockTransaction = { captureID: 'CAP-123', totalPayment: 100, status: 'APPROVED' };
        
        paypalRepoMock.findOne.mockResolvedValue(mockTransaction);
        httpServiceMock.post.mockResolvedValue({
          data: { status: 'COMPLETED', id: 'REF-222' }
        });

        const result = await service.payThroughGatewayService('PAYPAL_REFUND', payload, validToken);

        expect(result).toEqual({ success: true, refundID: 'REF-222' });
        expect(httpServiceMock.post).toHaveBeenCalledWith(expect.any(String), {});
        expect(paypalRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'REFUNDED' }));
      });
    });
  });
});