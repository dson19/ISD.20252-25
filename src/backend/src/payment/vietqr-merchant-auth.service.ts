import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { VietqrMerchantTokenResponse } from './vietqr.types';

/**
 * Lab 11 Design Review
 * Coupling:
 * - Data Coupling with VietqrMerchantController because it receives only the Basic Auth header value.
 * - Avoids Control Coupling by not knowing which merchant endpoint called it.
 * - Avoids Stamp Coupling by not receiving HTTP request objects.
 *
 * Cohesion:
 * - Functional Cohesion because this service only validates merchant Basic Auth and creates sandbox token responses.
 *
 * Reason:
 * - Authentication details are separate from routing and payment state transitions.
 *
 * Improvement Direction:
 * - Persist issued tokens with expiry if VietQR callback bearer-token verification becomes required.
 */
@Injectable()
export class VietqrMerchantAuthService {
  generateToken(authorization?: string): VietqrMerchantTokenResponse {
    this.validateBasicAuth(authorization);

    return {
      access_token: randomUUID(),
      token_type: 'Bearer',
      expires_in: 300,
    };
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
}
