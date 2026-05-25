import { VietqrCallbackDto } from './dto/vietqr-callback.dto';

export type VietqrPaymentStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';

export interface VietqrPaymentResponse {
  paymentId: number;
  orderId: number;
  amount: number;
  transactionRef: string | null;
  content: string;
  paymentContent: string;
  qrCode: string | null;
  qrLink: string | null;
  expiredAt: Date;
  status: VietqrPaymentStatus;
}

export interface VietqrCallbackResult {
  status: 'SUCCESS';
  message: 'Callback processed' | 'Callback already processed';
  paymentId: number;
}

export interface VietqrMerchantTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export type VietqrMerchantCallbackPayload = Record<string, unknown>;

export type VietqrNormalizedCallbackPayload = VietqrCallbackDto;
