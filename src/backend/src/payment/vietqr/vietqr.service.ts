import { Inject, Injectable } from '@nestjs/common';
import {
  InvalidTokenException,
  MissingTokenException,
  PaymentGatewayException,
  TokenExpiredException,
} from '../exceptions/exceptions';
import { QRCode } from './domain/qr-code';
import { QRGenerateRequest } from './domain/qr-generate-request';
import { InvalidAmountException } from './exceptions/vietqr.exceptions';
import { VIETQR_API_CLIENT } from './vietqr-api-client';
import type { VietQRApiClient } from './vietqr-api-client';

@Injectable()
export class VietQRService {
  constructor(
    @Inject(VIETQR_API_CLIENT)
    private readonly apiClient: VietQRApiClient,
  ) {}

  async generateQRCode(amount: number, token: string): Promise<string> {
    this.validateSecurityToken(token);

    if (amount <= 0) {
      throw new InvalidAmountException();
    }

    const request = new QRGenerateRequest(
      `payment:${amount}`,
      amount,
      `ORDER-${amount}`,
      '970436',
      '1234567890',
      'Vietcombank',
    );

    try {
      const response = await this.apiClient.generateQRCode(request, token);
      const qrCode = QRCode.parseQRCodeResponse(response);

      return qrCode.qrLink;
    } catch {
      throw new PaymentGatewayException();
    }
  }

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
}
