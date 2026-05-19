import { PaymentStatus, PaymentStatusValue } from './payment-status';

export class PaymentTransaction {
  constructor(
    public readonly invoiceId: number | null,
    public readonly amount: number,
    public readonly method: string,
    public status: PaymentStatusValue,
    public readonly transactionContent: string,
    public readonly createdAt: Date = new Date(),
    public readonly transactionId?: number,
  ) {}

  static create(invoiceId: number, amount: number, method: string): PaymentTransaction {
    return new PaymentTransaction(
      invoiceId,
      amount,
      method,
      PaymentStatus.pending().status,
      PaymentTransaction.buildContent(invoiceId, amount, method),
    );
  }

  static fromPaymentResult(status: PaymentStatus): PaymentTransaction {
    return new PaymentTransaction(
      null,
      0,
      'VietQR',
      status.status,
      status.message,
    );
  }

  updateStatus(status: PaymentStatusValue): void {
    this.status = status;
  }

  parseResponseString(response: string): void {
    const parsed = JSON.parse(response) as { status?: PaymentStatusValue };

    if (parsed.status) {
      this.updateStatus(parsed.status);
    }
  }

  private static buildContent(
    invoiceId: number,
    amount: number,
    method: string,
  ): string {
    return `invoice:${invoiceId};method:${method};amount:${amount}`;
  }
}
