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

interface VietqrApiConfig {
  apiBaseUrl: string;
  username: string;
  password: string;
  bankCode: string;
  bankAccount: string;
  userBankName: string;
}

/**
 * + Coupling/Cohesion level:
 *   - Common Coupling: VietqrApiClient reads endpoint configuration from `process.env`.
 *   - Data Coupling: Interacts with VietqrPaymentService by passing primitive scalar parameters.
 *   - Functional Cohesion: Focuses solely on communicating with the third-party VietQR API.
 * + Reason why:
 *   - Keeping API integration logic decoupled from application controllers and database tables ensures the class has a single, testable responsibility.
 */
@Injectable()
export class VietqrApiClient {
  private getConfig(): VietqrApiConfig {
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
    const config = this.getConfig();
    const token = await this.requestAccessToken(config);

    const response = await fetch(`${config.apiBaseUrl}/vqr/api/qr/generate-customer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bankCode: config.bankCode,
        bankAccount: config.bankAccount,
        userBankName: config.userBankName,
        amount: request.amount,
        content: request.content,
        orderId: request.orderId,
        qrType: 0,
        transType: 'C',
      }),
    });

    const data: any = await response.json().catch(() => ({}));
    console.log('VietQR generateQrCode response raw:', JSON.stringify(data));
    if (!response.ok || data.status === 'FAILED') {
      throw new BadRequestException(`VietQR QR generation failed: ${data.message || response.statusText}`);
    }

    return this.mapGenerateQrResponse(data);
  }

  private async requestAccessToken(config: VietqrApiConfig): Promise<string> {
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    const response = await fetch(`${config.apiBaseUrl}/vqr/api/token_generate`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    const rawText = await response.text();

    let data: any = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { raw: rawText };
    }

    const accessToken = data.access_token || data.accessToken || data.data?.access_token || data.data?.accessToken;

    if (!response.ok || data.status === 'FAILED' || !accessToken) {
      throw new BadRequestException(
        `VietQR token request failed: httpStatus=${response.status}, body=${JSON.stringify(data)}`,
      );
    }

    return accessToken;
  }

  private mapGenerateQrResponse(data: any): GenerateVietqrCodeResponse {
    // If the response is nested (e.g. data: { code: "00", desc: "...", data: { qrCode: "...", qrLink: "..." } })
    // we extract the inner data object.
    const root = data.data && typeof data.data === 'object' ? data.data : data;
    return {
      qrCode: root.qrCode ?? root.qrDataURL ?? null,
      qrLink: root.qrLink ?? root.qrDataURL ?? null,
      transactionId: root.transactionId ?? root.transactionID ?? null,
      transactionRefId: root.transactionRefId ?? root.transactionRefID ?? null,
      orderId: root.orderId ?? root.orderID ?? null,
    };
  }
}
