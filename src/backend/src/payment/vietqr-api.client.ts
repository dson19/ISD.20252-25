import { BadRequestException, Injectable } from '@nestjs/common';

export interface GenerateVietqrCodeRequest {
  orderId: string;
  amount: number;
  content: string;
}

export interface GenerateVietqrCodeResponse {
  qrCode: string | null;
  qrLink: string | null;
  transactionId: string | null;
  transactionRefId: string | null;
  orderId: string | null;
}

interface VietqrTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  status?: string;
  message?: string;
}

/**
 * Lab 11 Design Review
 * Coupling:
 * - Data Coupling with VietqrPaymentService because it accepts only amount, content, and order id needed for QR generation.
 * - Avoids Control Coupling by exposing a dedicated VietQR client instead of a generic gateway switch.
 * - Avoids Stamp Coupling by mapping external VietQR responses into a small internal response interface.
 *
 * Cohesion:
 * - Functional Cohesion because this class only handles VietQR API configuration, token retrieval, and QR generation.
 *
 * Reason:
 * - External API concerns should not be mixed with controller routing or database updates.
 *
 * Improvement Direction:
 * - Add token caching with expiry if VietQR traffic increases.
 */
@Injectable()
export class VietqrApiClient {
  private getConfig() {
    const apiBaseUrl = process.env.VIETQR_API_BASE_URL || 'https://dev.vietqr.org';
    const username = process.env.VIETQR_USERNAME;
    const password = process.env.VIETQR_PASSWORD;
    const bankCode = process.env.VIETQR_BANK_CODE;
    const bankAccount = process.env.VIETQR_BANK_ACCOUNT;
    const userBankName = process.env.VIETQR_BANK_ACCOUNT_NAME;

    if (!username || !password || !bankCode || !bankAccount || !userBankName) {
      throw new BadRequestException('VietQR API credentials or bank account configuration are missing');
    }

    return { apiBaseUrl, username, password, bankCode, bankAccount, userBankName };
  }

  async generateQrCode(request: GenerateVietqrCodeRequest): Promise<GenerateVietqrCodeResponse> {
    const token = await this.getAccessToken();
    const { apiBaseUrl, bankCode, bankAccount, userBankName } = this.getConfig();

    const response = await fetch(`${apiBaseUrl}/vqr/api/qr/generate-customer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bankCode,
        bankAccount,
        userBankName,
        amount: request.amount,
        content: request.content,
        orderId: request.orderId,
        qrType: 0,
        transType: 'C',
      }),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok || data.status === 'FAILED') {
      throw new BadRequestException(`VietQR QR generation failed: ${data.message || response.statusText}`);
    }

    return {
      qrCode: data.qrCode ?? null,
      qrLink: data.qrLink ?? null,
      transactionId: data.transactionId ?? null,
      transactionRefId: data.transactionRefId ?? null,
      orderId: data.orderId ?? null,
    };
  }

  private async getAccessToken(): Promise<string> {
    const { apiBaseUrl, username, password } = this.getConfig();
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    const response = await fetch(`${apiBaseUrl}/vqr/api/token_generate`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    const data = (await response.json().catch(() => ({}))) as VietqrTokenResponse;
    if (!response.ok || data.status === 'FAILED' || !data.access_token) {
      throw new BadRequestException(`VietQR token request failed: ${data.message || response.statusText}`);
    }

    return data.access_token;
  }
}
