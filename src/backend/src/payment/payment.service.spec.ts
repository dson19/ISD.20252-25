import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';

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

  describe('payThroughGatewayService - Validation Tests', () => {
    
    describe('PAYPAL_CREATE', () => {
      it('nên ném lỗi khi thiếu TẤT CẢ các tham số (payload rỗng)', async () => {
        await expect(
          service.payThroughGatewayService('PAYPAL_CREATE', {})
        ).rejects.toThrow('Thiếu các tham số bắt buộc: invoiceID, totalPayment');
      });

      it('nên ném lỗi khi chỉ thiếu mỗi totalPayment', async () => {
        const payload = { invoiceID: 'INV-123' };
        await expect(
          service.payThroughGatewayService('PAYPAL_CREATE', payload)
        ).rejects.toThrow('Thiếu các tham số bắt buộc: totalPayment');
      });

      it('nên ném lỗi khi chỉ thiếu mỗi invoiceID', async () => {
        const payload = { totalPayment: 100 };
        await expect(
          service.payThroughGatewayService('PAYPAL_CREATE', payload)
        ).rejects.toThrow('Thiếu các tham số bắt buộc: invoiceID');
      });

      it('nên ném lỗi khi totalPayment nhỏ hơn hoặc bằng 0', async () => {
        const payload = { invoiceID: 'INV-123', totalPayment: 0 };
        await expect(
          service.payThroughGatewayService('PAYPAL_CREATE', payload)
        ).rejects.toThrow('Số tiền thanh toán phải lớn hơn 0');
      });

      it('nên chạy thành công và trả về link approve khi đủ tham số hợp lệ', async () => {
        const payload = { invoiceID: 'INV-123', totalPayment: 150 };
        
        httpServiceMock.post.mockResolvedValue({
          data: {
            links: [{ rel: 'approve', href: 'https://paypal.com/approve/123' }]
          }
        });

        const result = await service.payThroughGatewayService('PAYPAL_CREATE', payload);
        expect(result).toBe('https://paypal.com/approve/123');
        expect(httpServiceMock.post).toHaveBeenCalled();
      });
    });

    describe('PAYPAL_CAPTURE', () => {
      it('nên ném lỗi khi thiếu TẤT CẢ các tham số (payload rỗng)', async () => {
        await expect(
          service.payThroughGatewayService('PAYPAL_CAPTURE', {})
        ).rejects.toThrow('Thiếu các tham số bắt buộc: payPalOrderID, captureStatus');
      });

      it('nên ném lỗi khi chỉ thiếu mỗi captureStatus', async () => {
        const payload = { payPalOrderID: 'PP-789' };
        await expect(
          service.payThroughGatewayService('PAYPAL_CAPTURE', payload)
        ).rejects.toThrow('Thiếu các tham số bắt buộc: captureStatus');
      });

      it('nên ném lỗi khi chỉ thiếu mỗi payPalOrderID', async () => {
        const payload = { captureStatus: 'COMPLETED' };
        await expect(
          service.payThroughGatewayService('PAYPAL_CAPTURE', payload)
        ).rejects.toThrow('Thiếu các tham số bắt buộc: payPalOrderID');
      });

      it('nên ném lỗi khi không tìm thấy transaction trong database', async () => {
        const payload = { payPalOrderID: 'NOT_FOUND', captureStatus: 'COMPLETED' };
        paypalRepoMock.findOne.mockResolvedValue(null);

        await expect(
          service.payThroughGatewayService('PAYPAL_CAPTURE', payload)
        ).rejects.toThrow('Không tìm thấy mã giao dịch này trong hệ thống');
      });
    });

  });
});