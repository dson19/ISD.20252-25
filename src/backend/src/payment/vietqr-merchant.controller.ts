import { Body, Controller, Headers, Post } from '@nestjs/common';
import { toVietqrCallbackDto } from './vietqr.mapper';
import { VietqrMerchantAuthService } from './vietqr-merchant-auth.service';
import { VietqrPaymentService } from './vietqr-payment.service';
import type { VietqrMerchantCallbackPayload } from './vietqr.types';

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
 *
 * Improvement Direction:
 * - Replace the sandbox token with persisted short-lived token validation if VietQR requires bearer verification in production callbacks.
 */
@Controller('vqr')
export class VietqrMerchantController {
  constructor(
    private readonly vietqrMerchantAuthService: VietqrMerchantAuthService,
    private readonly vietqrPaymentService: VietqrPaymentService,
  ) {}

  @Post('api/token_generate')
  generateToken(@Headers('authorization') authorization?: string) {
    return this.vietqrMerchantAuthService.generateToken(authorization);
  }

  @Post('bank/api/transaction-callback')
  async handleTransactionCallback(@Body() payload: VietqrMerchantCallbackPayload) {
    return await this.vietqrPaymentService.handleCallback(toVietqrCallbackDto(payload));
  }
}
