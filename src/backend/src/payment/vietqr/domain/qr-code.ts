export interface QRCodeGatewayPayload {
  qrLink?: string;
  qrUrl?: string;
  qrCode?: string;
  imageUrl?: string;
  data?: QRCodeGatewayPayload;
  bankName?: string;
  bankCode?: string;
  bankAccount?: string;
  amount?: number;
  content?: string;
  transactionId?: string;
  transactionRefId?: string;
}

export class QRCode {
  constructor(
    public readonly qrLink: string,
    public readonly qrCode: string = '',
    public readonly bankName: string = '',
    public readonly bankCode: string = '',
    public readonly bankAccount: string = '',
    public readonly amount: number = 0,
    public readonly content: string = '',
    public readonly transactionId: string = '',
    public readonly transactionRefId: string = '',
  ) {}

  static parseQRCodeResponse(response: unknown): QRCode {
    if (typeof response === 'string' && response.trim() !== '') {
      return new QRCode(response);
    }

    if (!response || typeof response !== 'object') {
      throw new Error('Invalid QR code response');
    }

    const payload = response as QRCodeGatewayPayload;
    const data = payload.data || payload;
    const qrLink = data.qrLink || data.qrUrl || data.imageUrl || data.qrCode;

    if (!qrLink) {
      throw new Error('QR code response is missing QR link');
    }

    return new QRCode(
      qrLink,
      data.qrCode || '',
      data.bankName || '',
      data.bankCode || '',
      data.bankAccount || '',
      data.amount || 0,
      data.content || '',
      data.transactionId || '',
      data.transactionRefId || '',
    );
  }

  parseQRCodeResponse(response: string): void {
    QRCode.parseQRCodeResponse(JSON.parse(response));
  }
}
