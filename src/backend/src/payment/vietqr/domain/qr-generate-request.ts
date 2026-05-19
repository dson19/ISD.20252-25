export class QRGenerateRequest {
  constructor(
    public readonly content: string,
    public readonly amount: number,
    public readonly orderId: string,
    public readonly bankCode: string,
    public readonly bankAccount: string,
    public readonly bankName: string,
    public readonly qrType: number = 0,
    public readonly transType: string = 'C',
    public readonly urlLink: string = '',
  ) {}

  buildRequestString(): string {
    return JSON.stringify({
      content: this.content,
      amount: this.amount,
      orderId: this.orderId,
      bankCode: this.bankCode,
      bankAccount: this.bankAccount,
      bankName: this.bankName,
      qrType: this.qrType,
      transType: this.transType,
      urlLink: this.urlLink,
    });
  }
}
