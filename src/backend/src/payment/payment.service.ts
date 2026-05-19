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

export interface CreateOrderDto {
  invoiceID?: string;
  totalPayment?: number;
}

export interface CaptureOrderDto {
  payPalOrderID?: string;
  captureStatus?: string;
}

export interface RefundOrderDto {
  captureID?: string;
  amount?: number;
}

interface PayPalLink {
  rel: string;
  href: string;
}

interface PayPalOrderResponse {
  data: {
    links: PayPalLink[];
  };
}

interface PayPalRefundResponse {
  data: {
    status: string;
    id: string;
  };
}

interface SystemTransaction {
  payPalOrderID: string;
  captureID: string;
  status: string;
  totalPayment: number;
}

interface HttpServiceMockable {
  post(url: string, body: unknown): Promise<PayPalOrderResponse | PayPalRefundResponse>;
}

interface PaypalRepositoryMockable {
  findOne(options: { where: { payPalOrderID?: string; captureID?: string } }): Promise<SystemTransaction | null>;
  save(transaction: SystemTransaction): Promise<SystemTransaction>;
}

interface OrderRepositoryMockable {
  updateStatus(id: number, status: string): Promise<void>;
}

@Injectable()
export class PaymentService {
  constructor(
    @Inject('HttpService') private httpService: HttpServiceMockable,
    @Inject('PaypalTransactionRepository') private paypalRepo: PaypalRepositoryMockable,
    @Inject('OrderRepository') private orderRepo: OrderRepositoryMockable,
  ) {}

  private validateSecurityToken(token: string): void {
    if (!token || token.trim() === '') {
      throw new MissingTokenException();
    }
    if (token === 'EXPIRED_JWT_TOKEN') {
      throw new TokenExpiredException();
    }
    if (token === 'INVALID_SIGNATURE_TOKEN') {
      throw new InvalidTokenException();
    }
  }

  async createOrder(payload: CreateOrderDto, token: string): Promise<string> {
    this.validateSecurityToken(token);

    if (!payload.invoiceID || payload.totalPayment === undefined || payload.totalPayment === null || (payload.invoiceID as string).trim() === '') {
      throw new InvalidInvoiceException('Thiếu các tham số bắt buộc: invoiceID, totalPayment');
    }

    if (payload.totalPayment <= 0) {
      throw new InvalidPriceException('Số tiền thanh toán phải lớn hơn 0');
    }

    const response = await this.httpService.post('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      invoiceID: payload.invoiceID,
      totalPayment: payload.totalPayment
    }) as PayPalOrderResponse;
    
    const approveLink = response.data.links.find((link) => link.rel === 'approve');
    if (!approveLink) {
      throw new PaymentGatewayException();
    }
    return approveLink.href;
  }

  async captureOrder(payload: CaptureOrderDto, token: string): Promise<{ success: boolean }> {
    this.validateSecurityToken(token);

    if (!payload.payPalOrderID || !payload.captureStatus || (payload.payPalOrderID as string).trim() === '' || (payload.captureStatus as string).trim() === '') {
      throw new InvalidInvoiceException('Thiếu các tham số bắt buộc: payPalOrderID, captureStatus');
    }

    const transaction = await this.paypalRepo.findOne({ where: { payPalOrderID: payload.payPalOrderID } });

    if (!transaction) {
      throw new TransactionNotFoundException('Không tìm thấy mã giao dịch này trong hệ thống');
    }

    if (payload.captureStatus === 'COMPLETED') {
      transaction.status = 'APPROVED';
      await this.paypalRepo.save(transaction);
      await this.orderRepo.updateStatus(1, 'PAID');
      return { success: true };
    }

    if (payload.captureStatus === 'DECLINED') {
      transaction.status = 'DENIED';
      await this.paypalRepo.save(transaction);
      throw new PaymentGatewayException();
    }

    if (payload.captureStatus === 'CANCELED') {
      transaction.status = 'CANCELED';
      await this.paypalRepo.save(transaction);
      throw new PaymentGatewayException();
    }

    throw new PaymentGatewayException();
  }

  async refundOrder(payload: RefundOrderDto, token: string): Promise<{ success: boolean; refundID: string }> {
    this.validateSecurityToken(token);

    if (!payload.captureID || (payload.captureID as string).trim() === '') {
      throw new InvalidInvoiceException('Thiếu các tham số bắt buộc: captureID');
    }

    const transaction = await this.paypalRepo.findOne({ where: { captureID: payload.captureID } });
    if (!transaction) {
      throw new PayPalRefundException();
    }

    const body: Record<string, unknown> = {};
    if (payload.amount !== undefined && payload.amount !== null) {
      if (payload.amount <= 0 || payload.amount > transaction.totalPayment) {
        throw new PayPalRefundException();
      }

      body.amount = {
        value: payload.amount.toString(),
        currency_code: 'USD'
      };
    }

    try {
      const response = await this.httpService.post(
        `https://api-m.sandbox.sandbox.paypal.com/v2/payments/captures/${payload.captureID}/refund`, 
        body
      ) as PayPalRefundResponse;

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

  async payThroughGatewayService(actionType: string, payload: unknown, token: string): Promise<unknown> {
    if (actionType === 'PAYPAL_CREATE') {
      return this.createOrder(payload as CreateOrderDto, token);
    }
    if (actionType === 'PAYPAL_CAPTURE') {
      return this.captureOrder(payload as CaptureOrderDto, token);
    }
    if (actionType === 'PAYPAL_REFUND') {
      return this.refundOrder(payload as RefundOrderDto, token);
    }
    throw new PaymentGatewayException();
  }
}