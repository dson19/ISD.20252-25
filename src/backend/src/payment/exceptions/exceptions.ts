import { HttpException, HttpStatus } from '@nestjs/common';

// --- NHÓM 1: CÁC EXCEPTION BẢO MẬT (TOKEN) ---
export class MissingTokenException extends HttpException {
  constructor() {
    super('MissingTokenException: Access token is required', HttpStatus.UNAUTHORIZED);
  }
}

export class TokenExpiredException extends HttpException {
  constructor() {
    super('TokenExpiredException: Access token has expired', HttpStatus.UNAUTHORIZED);
  }
}

export class InvalidTokenException extends HttpException {
  constructor() {
    super('InvalidTokenException: Access token is invalid or tampered', HttpStatus.UNAUTHORIZED);
  }
}

// --- NHÓM 2: CÁC EXCEPTION NGHIỆP VỤ HÓA ĐƠN / THANH TOÁN ---
export class InvalidInvoiceException extends HttpException {
  constructor(message?: string) {
    super(message || 'InvalidInvoiceException: Required fields are missing', HttpStatus.BAD_REQUEST);
  }
}

export class InvalidPriceException extends HttpException {
  constructor(message?: string) {
    super(message || 'InvalidPriceException: Amount must be greater than 0', HttpStatus.BAD_REQUEST);
  }
}

export class TransactionNotFoundException extends HttpException {
  constructor(message?: string) {
    super(message || 'TransactionNotFoundException: Transaction record not found', HttpStatus.NOT_FOUND);
  }
}

// --- NHÓM 3: CÁC EXCEPTION TỪ CỔNG THANH TOÁN (GATEWAY) ---
export class PaymentGatewayException extends HttpException {
  constructor(message?: string) {
    super(message || 'PaymentGatewayException: Payment gateway reported an error', HttpStatus.BAD_GATEWAY);
  }
}

export class PayPalRefundException extends HttpException {
  constructor(message?: string) {
    super(message || 'PayPalRefundException: Refund operation failed or invalid amount', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}