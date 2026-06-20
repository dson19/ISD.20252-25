import { CreateVietqrPaymentDto } from '../dto/create-vietqr-payment.dto';
import { VietqrCallbackDto } from '../dto/vietqr-callback.dto';
import { VietqrPaymentResponse, VietqrCallbackResult } from '../services/vietqr-payment.service';

export interface IVietQR {
  createPayment(dto: CreateVietqrPaymentDto): Promise<VietqrPaymentResponse>;
  getStatusByPaymentId(paymentId: number): Promise<VietqrPaymentResponse>;
  getStatusByTransactionRef(transactionRef: string): Promise<VietqrPaymentResponse>;
  triggerTestCallback(paymentId: number): Promise<{ status: string }>;
  handleCallback(dto: VietqrCallbackDto): Promise<VietqrCallbackResult>;
}
