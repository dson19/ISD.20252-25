import { PaymentTransaction } from './domain/payment-transaction';
import { QRGenerateRequest } from './domain/qr-generate-request';

export const VIETQR_API_CLIENT = 'VietQRApiClient';

export interface VietQRApiClient {
  getAccessToken?(requestString: string): Promise<unknown>;
  generateQRCode(request: QRGenerateRequest, token: string): Promise<unknown>;
  checkPaymentStatus?(
    requestString: string,
    token: string,
  ): Promise<PaymentTransaction>;
}
