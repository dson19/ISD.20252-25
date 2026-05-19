import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidAmountException extends HttpException {
  constructor(message?: string) {
    super(
      message || 'InvalidAmountException: Amount must be greater than 0',
      HttpStatus.BAD_REQUEST,
    );
  }
}
