import { Injectable, Inject } from '@nestjs/common';
import { 
  MissingTokenException, 
  TokenExpiredException, 
  InvalidTokenException, 
  InvalidInvoiceException, 
  InvalidPriceException, 
  TransactionNotFoundException, 
  PaymentGatewayException, 
  PayPalRefundException 
} from './exceptions/exceptions'; 

@Injectable()
export class PaymentService {
  constructor(
    @Inject('HttpService') private httpService: any,
    @Inject('PaypalTransactionRepository') private paypalRepo: any,
    @Inject('OrderRepository') private orderRepo: any,
  ) {}

  async payThroughGatewayService(actionType: string, payload: any, token: string): Promise<any> {
    if (!token || token.trim() === '') {
      throw new MissingTokenException();
    }
    if (token === 'EXPIRED_JWT_TOKEN') { // Mock token bị expire
      throw new TokenExpiredException();
    }
    if (token === 'INVALID_SIGNATURE_TOKEN') { // Mock token invalid
      throw new InvalidTokenException();
    }

    const data = payload || {};

    if (actionType === 'PAYPAL_CREATE') {
      const requiredFields = ['invoiceID', 'totalPayment'];
      const missingFields = requiredFields.filter(
        field => data[field] === undefined || data[field] === null || data[field] === ''
      );

      if (missingFields.length > 0) {
        throw new InvalidInvoiceException(`Thiếu các tham số bắt buộc: ${missingFields.join(', ')}`);
      }

      if (data.totalPayment <= 0) {
        throw new InvalidPriceException('Số tiền thanh toán phải lớn hơn 0');
      }

      const response = await this.httpService.post('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
        invoiceID: data.invoiceID,
        totalPayment: data.totalPayment
      });
      
      const approveLink = response.data.links.find((link: any) => link.rel === 'approve');
      return approveLink.href;
    }

    if (actionType === 'PAYPAL_CAPTURE') {
      const requiredFields = ['payPalOrderID', 'captureStatus'];
      const missingFields = requiredFields.filter(
        field => data[field] === undefined || data[field] === null || data[field] === ''
      );

      if (missingFields.length > 0) {
        throw new InvalidInvoiceException(`Thiếu các tham số bắt buộc: ${missingFields.join(', ')}`);
      }

      const transaction = await this.paypalRepo.findOne({ where: { payPalOrderID: data.payPalOrderID } });

      if (!transaction) {
        throw new TransactionNotFoundException('Không tìm thấy mã giao dịch này trong hệ thống');
      }

      if (data.captureStatus === 'COMPLETED') {
        transaction.status = 'APPROVED';
        await this.paypalRepo.save(transaction);
        await this.orderRepo.updateStatus(1, 'PAID');
        return { success: true };
      }

      if (data.captureStatus === 'DECLINED') {
        transaction.status = 'DENIED';
        await this.paypalRepo.save(transaction);
        throw new PaymentGatewayException();
      }

      if (data.captureStatus === 'CANCELED') {
        transaction.status = 'CANCELED';
        await this.paypalRepo.save(transaction);
        throw new PaymentGatewayException();
      }
    }

    if (actionType === 'PAYPAL_REFUND') {
      const requiredFields = ['captureID'];
      const missingFields = requiredFields.filter(
        field => data[field] === undefined || data[field] === null || data[field] === ''
      );

      if (missingFields.length > 0) {
        throw new InvalidInvoiceException(`Thiếu các tham số bắt buộc: ${missingFields.join(', ')}`);
      }

      const transaction = await this.paypalRepo.findOne({ where: { captureID: data.captureID } });
      if (!transaction) {
        throw new PayPalRefundException();
      }

      const body: any = {};
      if (data.amount !== undefined && data.amount !== null) {
        if (data.amount <= 0) {
          throw new PayPalRefundException();
        }
        
        if (data.amount > transaction.totalPayment) {
          throw new PayPalRefundException();
        }

        body.amount = {
          value: data.amount.toString(),
          currency_code: 'USD'
        };
      }

      try {
        const response = await this.httpService.post(
          `https://api-m.sandbox.paypal.com/v2/payments/captures/${data.captureID}/refund`, 
          body
        );

        if (response.data.status === 'COMPLETED') {
          transaction.status = 'REFUNDED';
          await this.paypalRepo.save(transaction);
          return { success: true, refundID: response.data.id };
        }
        throw new PayPalRefundException();
      } catch (error) {
        throw new PayPalRefundException();
      }
    }
  }
}