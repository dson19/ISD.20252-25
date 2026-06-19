import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { VietqrCallbackDto } from '../dto/vietqr-callback.dto';
import { VietqrPaymentService } from '../services/vietqr-payment.service';

/**
 * Lab 11 Design Review
 * Coupling:
 * - Data Coupling with VietqrPaymentService because this controller maps merchant callback fields into the existing callback DTO only.
 * - Avoids Control Coupling by not deciding payment state transitions or gateway behavior inside merchant-facing routes.
 * - Avoids Stamp Coupling by not passing the raw VietQR merchant payload beyond the HTTP boundary.
 *
 * Cohesion:
 * - Functional Cohesion because this class only exposes VietQR merchant sandbox endpoints for token testing and transaction callbacks.
 *
 * Reason:
 * - VietQR merchant portal integration has a different URL contract from internal payment APIs, so it stays in a separate controller.
 * - The Basic Auth sandbox logic is inlined here because it has exactly one merchant-facing consumer.
 */
@Controller('vqr')
export class VietqrMerchantController {
  constructor(private readonly vietqrPaymentService: VietqrPaymentService) {}

  @Post('api/token_generate')
  generateToken(@Headers('authorization') authorization?: string) {
    this.validateBasicAuth(authorization);

    return {
      access_token: randomUUID(),
      token_type: 'Bearer' as const,
      expires_in: 300,
    };
  }

  @Post('bank/api/transaction-callback')
  async handleTransactionCallback(@Body() payload: Record<string, unknown>) {
    return await this.vietqrPaymentService.handleCallback(this.toCallbackDto(payload));
  }

  @Post('bank/api/transaction-sync')
  async handleTransactionSync(@Body() payload: Record<string, unknown>) {
    return await this.vietqrPaymentService.handleCallback(this.toCallbackDto(payload));
  }

  private validateBasicAuth(authorization?: string): void {
    const prefix = 'Basic ';
    if (!authorization?.startsWith(prefix)) {
      throw new UnauthorizedException('Invalid VietQR merchant credentials');
    }

    const credentials = Buffer.from(authorization.slice(prefix.length), 'base64').toString('utf8');
    const separatorIndex = credentials.indexOf(':');
    const username = separatorIndex >= 0 ? credentials.slice(0, separatorIndex) : '';
    const password = separatorIndex >= 0 ? credentials.slice(separatorIndex + 1) : '';

    if (username !== process.env.VIETQR_MERCHANT_USERNAME || password !== process.env.VIETQR_MERCHANT_PASSWORD) {
      throw new UnauthorizedException('Invalid VietQR merchant credentials');
    }
  }

  private toCallbackDto(payload: Record<string, unknown>): VietqrCallbackDto {
    return {
      bankaccount: String(payload.bankaccount ?? payload.bankAccount ?? ''),
      amount: Number(payload.amount),
      transType: String(payload.transType ?? '') as 'C' | 'D',
      content: String(payload.content ?? ''),
      transactionid: String(payload.transactionid ?? payload.transactionId ?? ''),
      transactiontime: Number(payload.transactiontime ?? payload.transactionTime),
      referencenumber: String(payload.referencenumber ?? payload.referenceNumber ?? ''),
      orderId: String(payload.orderId ?? payload.orderid ?? ''),
      terminalCode:
        payload.terminalCode === undefined || payload.terminalCode === null ? undefined : String(payload.terminalCode),
      sign: payload.sign === undefined || payload.sign === null ? undefined : String(payload.sign),
    };
  }
}
