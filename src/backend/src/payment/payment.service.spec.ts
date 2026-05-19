import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService, CreateOrderDto, CaptureOrderDto, RefundOrderDto } from './payment.service';
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

interface SimpleHttpService {
  post: jest.Mock;
}

interface SimpleRepository {
  findOne: jest.Mock;
  save: jest.Mock;
}

interface SimpleOrderRepository {
  updateStatus: jest.Mock;
}

describe('PaymentService', () => {
  let service: PaymentService;
  let httpServiceMock: jest.Mocked<SimpleHttpService>;
  let paypalRepoMock: jest.Mocked<SimpleRepository>;
  let orderRepoMock: jest.Mocked<SimpleOrderRepository>;

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

  describe('createOrder - Unit Method Execution', () => {
    const validToken = 'VALID_JWT_TOKEN';
    const standardPayload: CreateOrderDto = { invoiceID: 'INV-123', totalPayment: 100 };

    it('nên ném lỗi MissingTokenException khi thiếu token hoặc token rỗng', async () => {
      await expect(service.createOrder(standardPayload, '')).rejects.toThrow(MissingTokenException);
    });

    it('nên ném lỗi TokenExpiredException khi truyền token hết hạn', async () => {
      await expect(service.createOrder(standardPayload, 'EXPIRED_JWT_TOKEN')).rejects.toThrow(TokenExpiredException);
    });

    it('nên ném lỗi InvalidTokenException khi truyền token sai chữ ký/hỏng', async () => {
      await expect(service.createOrder(standardPayload, 'INVALID_SIGNATURE_TOKEN')).rejects.toThrow(InvalidTokenException);
    });

    it('nên ném lỗi khi thiếu TẤT CẢ các tham số (payload rỗng)', async () => {
      await expect(service.createOrder({}, validToken)).rejects.toThrow(InvalidInvoiceException);
    });

    it('nên ném lỗi khi chỉ thiếu mỗi totalPayment', async () => {
      const payload: CreateOrderDto = { invoiceID: 'INV-123' };
      await expect(service.createOrder(payload, validToken)).rejects.toThrow(InvalidInvoiceException);
    });

    it('nên ném lỗi khi chỉ thiếu mỗi invoiceID', async () => {
      const payload: CreateOrderDto = { totalPayment: 100 };
      await expect(service.createOrder(payload, validToken)).rejects.toThrow(InvalidInvoiceException);
    });

    it('nên ném lỗi khi totalPayment bằng 0', async () => {
      const payload: CreateOrderDto = { invoiceID: 'INV-123', totalPayment: 0 };
      await expect(service.createOrder(payload, validToken)).rejects.toThrow(InvalidPriceException);
    });

    it('nên ném lỗi khi totalPayment âm', async () => {
      const payload: CreateOrderDto = { invoiceID: 'INV-123', totalPayment: -50 };
      await expect(service.createOrder(payload, validToken)).rejects.toThrow(InvalidPriceException);
    });

    it('nên chạy thành công và trả về link approve khi đủ tham số hợp lệ', async () => {
      const payload: CreateOrderDto = { invoiceID: 'INV-123', totalPayment: 150 };
      httpServiceMock.post.mockResolvedValue({
        data: {
          links: [{ rel: 'approve', href: 'https://paypal.com/approve/123' }]
        }
      });

      const result = await service.createOrder(payload, validToken);
      expect(result).toBe('https://paypal.com/approve/123');
      expect(httpServiceMock.post).toHaveBeenCalledWith('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
        invoiceID: payload.invoiceID,
        totalPayment: payload.totalPayment
      });
    });
  });

  describe('captureOrder - Unit Method Execution', () => {
    const validToken = 'VALID_JWT_TOKEN';
    const standardPayload: CaptureOrderDto = { payPalOrderID: 'PP-789', captureStatus: 'COMPLETED' };

    it('nên ném lỗi MissingTokenException khi thiếu token hoặc token rỗng', async () => {
      await expect(service.captureOrder(standardPayload, '')).rejects.toThrow(MissingTokenException);
    });

    it('nên ném lỗi TokenExpiredException khi truyền token hết hạn', async () => {
      await expect(service.captureOrder(standardPayload, 'EXPIRED_JWT_TOKEN')).rejects.toThrow(TokenExpiredException);
    });

    it('nên ném lỗi InvalidTokenException khi truyền token sai chữ ký/hỏng', async () => {
      await expect(service.captureOrder(standardPayload, 'INVALID_SIGNATURE_TOKEN')).rejects.toThrow(InvalidTokenException);
    });

    it('nên ném lỗi khi thiếu TẤT CẢ các tham số (payload rỗng)', async () => {
      await expect(service.captureOrder({}, validToken)).rejects.toThrow(InvalidInvoiceException);
    });

    it('nên ném lỗi khi chỉ thiếu mỗi captureStatus', async () => {
      const payload: CaptureOrderDto = { payPalOrderID: 'PP-789' };
      await expect(service.captureOrder(payload, validToken)).rejects.toThrow(InvalidInvoiceException);
    });

    it('nên ném lỗi khi chỉ thiếu mỗi payPalOrderID', async () => {
      const payload: CaptureOrderDto = { captureStatus: 'COMPLETED' };
      await expect(service.captureOrder(payload, validToken)).rejects.toThrow(InvalidInvoiceException);
    });

    it('nên ném lỗi TransactionNotFoundException khi không tìm thấy transaction trong database', async () => {
      const payload: CaptureOrderDto = { payPalOrderID: 'NOT_FOUND', captureStatus: 'COMPLETED' };
      paypalRepoMock.findOne.mockResolvedValue(null);

      await expect(service.captureOrder(payload, validToken)).rejects.toThrow(TransactionNotFoundException);
    });

    it('nên cập nhật trạng thái đơn hàng thành PAID khi capture thành công (COMPLETED)', async () => {
      const payload: CaptureOrderDto = { payPalOrderID: 'PP-789', captureStatus: 'COMPLETED' };
      const mockTransaction = { payPalOrderID: 'PP-789', status: 'PENDING' };
      paypalRepoMock.findOne.mockResolvedValue(mockTransaction);

      const result = await service.captureOrder(payload, validToken);
      
      expect(result).toEqual({ success: true });
      expect(paypalRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'APPROVED' }));
      expect(orderRepoMock.updateStatus).toHaveBeenCalledWith(1, 'PAID');
    });

    it('nên cập nhật trạng thái transaction thành DENIED và ném lỗi PaymentGatewayException khi trạng thái là DECLINED', async () => {
      const payload: CaptureOrderDto = { payPalOrderID: 'PP-789', captureStatus: 'DECLINED' };
      const mockTransaction = { payPalOrderID: 'PP-789', status: 'PENDING' };
      paypalRepoMock.findOne.mockResolvedValue(mockTransaction);

      await expect(service.captureOrder(payload, validToken)).rejects.toThrow(PaymentGatewayException);
      expect(paypalRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'DENIED' }));
    });

    it('nên cập nhật trạng thái transaction thành CANCELED và ném lỗi PaymentGatewayException khi trạng thái là CANCELED', async () => {
      const payload: CaptureOrderDto = { payPalOrderID: 'PP-789', captureStatus: 'CANCELED' };
      const mockTransaction = { payPalOrderID: 'PP-789', status: 'PENDING' };
      paypalRepoMock.findOne.mockResolvedValue(mockTransaction);

      await expect(service.captureOrder(payload, validToken)).rejects.toThrow(PaymentGatewayException);
      expect(paypalRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'CANCELED' }));
    });
  });

  describe('refundOrder - Unit Method Execution', () => {
    const validToken = 'VALID_JWT_TOKEN';
    const standardPayload: RefundOrderDto = { captureID: 'CAP-123', amount: 50 };

    it('nên ném lỗi MissingTokenException khi thiếu token hoặc token rỗng', async () => {
      await expect(service.refundOrder(standardPayload, '')).rejects.toThrow(MissingTokenException);
    });

    it('nên ném lỗi TokenExpiredException khi truyền token hết hạn', async () => {
      await expect(service.refundOrder(standardPayload, 'EXPIRED_JWT_TOKEN')).rejects.toThrow(TokenExpiredException);
    });

    it('nên ném lỗi InvalidTokenException khi truyền token sai chữ ký/hỏng', async () => {
      await expect(service.refundOrder(standardPayload, 'INVALID_SIGNATURE_TOKEN')).rejects.toThrow(InvalidTokenException);
    });

    it('nên ném lỗi khi thiếu tham số captureID', async () => {
      await expect(service.refundOrder({}, validToken)).rejects.toThrow(InvalidInvoiceException);
    });

    it('nên ném lỗi PayPalRefundException khi số tiền amount nhỏ hơn hoặc bằng 0', async () => {
      const payload: RefundOrderDto = { captureID: 'CAP-123', amount: 0 };
      const mockTransaction = { captureID: 'CAP-123', totalPayment: 100 };
      paypalRepoMock.findOne.mockResolvedValue(mockTransaction);

      await expect(service.refundOrder(payload, validToken)).rejects.toThrow(PayPalRefundException);
    });

    it('nên ném lỗi PayPalRefundException khi không tìm thấy giao dịch tương ứng với captureID trong database', async () => {
      const payload: RefundOrderDto = { captureID: 'NOT_FOUND', amount: 50 };
      paypalRepoMock.findOne.mockResolvedValue(null);

      await expect(service.refundOrder(payload, validToken)).rejects.toThrow(PayPalRefundException);
    });

    it('nên ném lỗi PayPalRefundException khi số tiền yêu cầu hoàn vượt quá hạn mức thanh toán gốc', async () => {
      const payload: RefundOrderDto = { captureID: 'CAP-123', amount: 150 };
      const mockTransaction = { captureID: 'CAP-123', totalPayment: 100, status: 'APPROVED' };
      paypalRepoMock.findOne.mockResolvedValue(mockTransaction);

      await expect(service.refundOrder(payload, validToken)).rejects.toThrow(PayPalRefundException);
    });

    it('nên hoàn tiền một phần thành công khi các tham số đều hợp lệ', async () => {
      const payload: RefundOrderDto = { captureID: 'CAP-123', amount: 40 };
      const mockTransaction = { captureID: 'CAP-123', totalPayment: 100, status: 'APPROVED' };
      
      paypalRepoMock.findOne.mockResolvedValue(mockTransaction);
      httpServiceMock.post.mockResolvedValue({
        data: { status: 'COMPLETED', id: 'REF-111' }
      });

      const result = await service.refundOrder(payload, validToken);

      expect(result).toEqual({ success: true, refundID: 'REF-111' });
      expect(paypalRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'REFUNDED' }));
    });

    it('nên hoàn tiền toàn bộ 100% thành công khi không truyền tham số amount', async () => {
      const payload: RefundOrderDto = { captureID: 'CAP-123' };
      const mockTransaction = { captureID: 'CAP-123', totalPayment: 100, status: 'APPROVED' };
      
      paypalRepoMock.findOne.mockResolvedValue(mockTransaction);
      httpServiceMock.post.mockResolvedValue({
        data: { status: 'COMPLETED', id: 'REF-222' }
      });

      const result = await service.refundOrder(payload, validToken);

      expect(result).toEqual({ success: true, refundID: 'REF-222' });
      expect(httpServiceMock.post).toHaveBeenCalledWith(
        'https://api-m.sandbox.sandbox.paypal.com/v2/payments/captures/CAP-123/refund',
        {}
      );
      expect(paypalRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'REFUNDED' }));
    });
  });

  describe('payThroughGatewayService - Router Routing Layer', () => {
    const validToken = 'VALID_JWT_TOKEN';

    it('nên gọi chính xác phương thức createOrder khi actionType là PAYPAL_CREATE', async () => {
      const payload: CreateOrderDto = { invoiceID: 'INV-123', totalPayment: 150 };
      httpServiceMock.post.mockResolvedValue({
        data: { links: [{ rel: 'approve', href: 'https://paypal.com/approve/123' }] }
      });

      const result = await service.payThroughGatewayService('PAYPAL_CREATE', payload, validToken);
      expect(result).toBe('https://paypal.com/approve/123');
    });

    it('nên gọi chính xác phương thức captureOrder khi actionType là PAYPAL_CAPTURE', async () => {
      const payload: CaptureOrderDto = { payPalOrderID: 'PP-789', captureStatus: 'COMPLETED' };
      const mockTransaction = { payPalOrderID: 'PP-789', status: 'PENDING' };
      paypalRepoMock.findOne.mockResolvedValue(mockTransaction);

      const result = await service.payThroughGatewayService('PAYPAL_CAPTURE', payload, validToken);
      expect(result).toEqual({ success: true });
    });

    it('nên gọi chính xác phương thức refundOrder khi actionType là PAYPAL_REFUND', async () => {
      const payload: RefundOrderDto = { captureID: 'CAP-123' };
      const mockTransaction = { captureID: 'CAP-123', totalPayment: 100, status: 'APPROVED' };
      paypalRepoMock.findOne.mockResolvedValue(mockTransaction);
      httpServiceMock.post.mockResolvedValue({
        data: { status: 'COMPLETED', id: 'REF-222' }
      });

      const result = await service.payThroughGatewayService('PAYPAL_REFUND', payload, validToken);
      expect(result).toEqual({ success: true, refundID: 'REF-222' });
    });

    it('nên ném lỗi PaymentGatewayException khi truyền sai actionType', async () => {
      await expect(service.payThroughGatewayService('INVALID_ACTION', {}, validToken)).rejects.toThrow(PaymentGatewayException);
    });
  });
});