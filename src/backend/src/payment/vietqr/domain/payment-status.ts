export type PaymentStatusValue = 'PENDING' | 'SUCCESS' | 'FAILED';

export class PaymentStatus {
  constructor(
    public readonly status: PaymentStatusValue,
    public readonly message: string = '',
  ) {}

  static pending(message = 'Payment is pending'): PaymentStatus {
    return new PaymentStatus('PENDING', message);
  }

  static fromCallback(
    callbackStatus: 'SUCCESS' | 'FAILED',
    currentOrderState: string,
  ): PaymentStatus {
    if (currentOrderState !== 'PENDING') {
      return new PaymentStatus('FAILED', 'Payment can only be updated from PENDING');
    }

    if (callbackStatus === 'SUCCESS') {
      return new PaymentStatus('SUCCESS', 'Payment completed successfully');
    }

    return new PaymentStatus('FAILED', 'Payment failed');
  }

  static parseResponseString(response: string): PaymentStatus {
    const parsed = JSON.parse(response) as { status?: PaymentStatusValue; message?: string };

    if (!parsed.status) {
      throw new Error('Payment status response is missing status');
    }

    return new PaymentStatus(parsed.status, parsed.message || '');
  }
}
