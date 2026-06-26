import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VietqrCallbackDto } from '../dto/vietqr-callback.dto';
import { VietqrTransaction } from '../entities/vietqr-transaction.entity';
import { VietqrApiClient } from '../API/vietqr-api.client';
import { VietqrRepository } from '../repositories/vietqr.repository';
import {
  IPaymentQRCode,
  QrCallbackResult,
  QrStatusResult,
  VietqrPaymentResponse,
} from '../interfaces/payment-qrcode.interface';

/**
 * + Coupling/Cohesion level:
 *   - Data Coupling: Trao đổi tham số nguyên thủy với VietqrRepository và VietqrApiClient.
 *   - Functional Cohesion: CHỈ lo việc đặc thù cổng VietQR — gọi VietQR API, ghi VietqrTransaction
 *     (kho riêng của cổng) và xác thực callback ngân hàng. KHÔNG đụng PaymentTransaction (bảng chung)
 *     / Order / notification — những việc đó do PaymentService điều phối.
 *
 * + SOLID Principles Review:
 *   - SRP Adherence: Adapter cổng thuần cho modality QR. Vòng đời PaymentTransaction + cập nhật Order
 *     + publish do PaymentService lo.
 *   - ISP Adherence: implements IPaymentQRCode — interface riêng (không capture, không refund tự động),
 *     không bị ép theo luồng thẻ tín dụng.
 */
@Injectable()
export class VietqrPaymentService implements IPaymentQRCode {
  readonly method = 'VIETQR';

  constructor(
    private readonly vietqrRepository: VietqrRepository,
    private readonly vietqrApiClient: VietqrApiClient,
  ) { }

  /** Tìm giao dịch QR đang chờ tái dùng được (cùng order + amount) để PaymentService khỏi tạo tx trùng. */
  async findReusablePending(orderId: number, amount: number): Promise<VietqrPaymentResponse | null> {
    const normalizedAmount = Math.round(amount);
    const existingPending = await this.vietqrRepository.findPendingByOrderAndAmount(orderId, normalizedAmount);
    if (!existingPending) {
      return null;
    }
    return this.toPaymentResponse(existingPending, existingPending.paymentTransaction.transactionID);
  }

  async createPayment(
    orderId: number,
    amount: number,
    content: string,
    paymentTransactionId: number,
  ): Promise<VietqrPaymentResponse> {
    this.validateOrderIdForVietqr(orderId);
    const normalizedAmount = Math.round(amount);
    this.validateAmount(normalizedAmount);
    const normalizedContent = this.validateAndNormalizeContent(content);

    const qrResponse = await this.vietqrApiClient.generateQrCode({
      orderId: String(orderId),
      amount: normalizedAmount,
      content: normalizedContent,
    });
    const expiredAt = this.calculateExpiredAt();

    const vietqrTransaction = await this.vietqrRepository.createVietqrTransaction({
      paymentTransactionId,
      orderId,
      amount: normalizedAmount,
      content: normalizedContent,
      qrCode: qrResponse.qrCode,
      qrLink: qrResponse.qrLink,
      transactionId: qrResponse.transactionId,
      transactionRefId: qrResponse.transactionRefId,
      expiredAt,
    });

    return this.toPaymentResponse(vietqrTransaction, paymentTransactionId);
  }

  async getStatusByPaymentId(paymentId: number): Promise<QrStatusResult> {
    const vietqrTransaction = await this.vietqrRepository.findByPaymentTransactionId(paymentId);
    if (!vietqrTransaction) {
      throw new NotFoundException(`VietQR payment ${paymentId} was not found`);
    }

    const expired = await this.expireIfNeeded(vietqrTransaction);
    return {
      response: this.toPaymentResponse(vietqrTransaction, paymentId),
      expired,
      paymentTransactionId: paymentId,
    };
  }

  async getStatusByTransactionRef(transactionRef: string): Promise<QrStatusResult> {
    const vietqrTransaction = await this.vietqrRepository.findByTransactionRefId(transactionRef);
    if (!vietqrTransaction) {
      throw new NotFoundException(`VietQR transaction reference ${transactionRef} was not found`);
    }

    const expired = await this.expireIfNeeded(vietqrTransaction);
    const paymentTransactionId = vietqrTransaction.paymentTransaction.transactionID;
    return {
      response: this.toPaymentResponse(vietqrTransaction, paymentTransactionId),
      expired,
      paymentTransactionId,
    };
  }

  async triggerTestCallback(paymentId: number): Promise<{ status: string }> {
    const apiBaseUrl = process.env.VIETQR_API_BASE_URL || 'https://dev.vietqr.org';
    if (!apiBaseUrl.includes('dev.vietqr.org')) {
      throw new BadRequestException('Test callback is only available in the dev/sandbox environment');
    }

    const vietqrTransaction = await this.vietqrRepository.findByPaymentTransactionId(paymentId);
    if (!vietqrTransaction) {
      throw new NotFoundException(`VietQR payment ${paymentId} was not found`);
    }

    if (vietqrTransaction.status !== 'PENDING') {
      throw new BadRequestException(`Payment is already ${vietqrTransaction.status}`);
    }

    await this.vietqrApiClient.triggerTestCallback({
      bankAccount: process.env.VIETQR_BANK_ACCOUNT || '',
      content: vietqrTransaction.content,
      amount: Math.round(Number(vietqrTransaction.amount)),
      bankCode: process.env.VIETQR_BANK_CODE || '',
    });

    return { status: 'SUCCESS' };
  }

  /**
   * Xác thực + đánh dấu giao dịch QR đã trả (việc đặc thù cổng). KHÔNG đụng PaymentTransaction / Order /
   * notification — trả cờ `changed` để PaymentService quyết định hệ quả (onPaymentConfirmed).
   */
  async handleCallback(dto: VietqrCallbackDto): Promise<QrCallbackResult> {
    if (dto.transType !== 'C') {
      throw new BadRequestException('Only credit VietQR callbacks can mark a payment as paid');
    }

    const vietqrTransaction = await this.findCallbackTarget(dto);
    this.validateCallback(vietqrTransaction, dto);

    const paymentTransactionId = vietqrTransaction.paymentTransaction.transactionID;

    if (vietqrTransaction.status === 'PAID') {
      return { changed: false, paymentTransactionId, orderId: vietqrTransaction.orderId, message: 'Callback already processed' };
    }

    if (vietqrTransaction.status !== 'PENDING') {
      throw new BadRequestException(`VietQR payment is ${vietqrTransaction.status}`);
    }

    const paidAt = new Date(dto.transactiontime);
    const transactionRefId = dto.referencenumber.trim() || vietqrTransaction.transactionRefId;
    const changed = await this.vietqrRepository.markPaidIfPending(vietqrTransaction.vietqrTransactionID, {
      transactionId: dto.transactionid,
      transactionRefId,
      paidAt,
      rawCallback: this.sanitizeCallback(dto),
    });

    return {
      changed,
      paymentTransactionId,
      orderId: vietqrTransaction.orderId,
      message: changed ? 'Callback processed' : 'Callback already processed',
    };
  }

  private async findCallbackTarget(dto: VietqrCallbackDto): Promise<VietqrTransaction> {
    const transactionRefId = dto.referencenumber.trim();
    if (transactionRefId) {
      const byReference = await this.vietqrRepository.findByTransactionRefId(transactionRefId);
      if (byReference) {
        return byReference;
      }
    }

    const normalizedContent = (dto.content ?? '').trim().toUpperCase();
    const parsedOrderId = Number(dto.orderId);
    if (parsedOrderId > 0) {
      const byDetails = await this.vietqrRepository.findByContentOrderAndAmount(
        normalizedContent,
        parsedOrderId,
        Number(dto.amount),
      );
      if (byDetails) {
        return byDetails;
      }
    }

    const byContentAmount = await this.vietqrRepository.findByContentAndAmount(
      normalizedContent,
      Number(dto.amount),
    );
    if (byContentAmount) {
      return byContentAmount;
    }

    throw new NotFoundException('Matching VietQR payment was not found');
  }

  private validateCallback(vietqrTransaction: VietqrTransaction, dto: VietqrCallbackDto): void {
    const parsedOrderId = Number(dto.orderId);
    if (parsedOrderId > 0 && String(vietqrTransaction.orderId) !== dto.orderId) {
      throw new BadRequestException('VietQR callback orderId does not match payment');
    }

    if (Math.round(Number(vietqrTransaction.amount)) !== Math.round(Number(dto.amount))) {
      throw new BadRequestException('VietQR callback amount does not match payment');
    }

    const dbContent = (vietqrTransaction.content ?? '').trim().toUpperCase();
    const callbackContent = (dto.content ?? '').trim().toUpperCase();
    if (dbContent !== callbackContent) {
      throw new BadRequestException('VietQR callback content does not match payment');
    }
  }

  /**
   * Đánh dấu giao dịch QR hết hạn (việc đặc thù cổng). Trả `true` nếu vừa chuyển sang EXPIRED để
   * PaymentService cập nhật PaymentTransaction → FAILED. KHÔNG tự đụng bảng chung.
   */
  private async expireIfNeeded(vietqrTransaction: VietqrTransaction): Promise<boolean> {
    if (vietqrTransaction.status !== 'PENDING' || vietqrTransaction.expiredAt.getTime() > Date.now()) {
      return false;
    }

    await this.vietqrRepository.markExpired(vietqrTransaction.vietqrTransactionID);
    vietqrTransaction.status = 'EXPIRED';
    return true;
  }

  private validateOrderIdForVietqr(orderId: number): void {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      throw new BadRequestException('orderId must be positive');
    }

    if (String(orderId).length > 13) {
      throw new BadRequestException('VietQR orderId must not exceed 13 characters');
    }
  }

  private validateAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount must be positive');
    }
  }

  private validateAndNormalizeContent(content: string): string {
    const normalizedContent = content.trim().toUpperCase();
    if (!normalizedContent || normalizedContent.length > 23 || !/^[A-Za-z0-9 ]+$/.test(normalizedContent)) {
      throw new BadRequestException('VietQR payment content must be at most 23 non-accented alphanumeric characters');
    }

    return normalizedContent;
  }

  private calculateExpiredAt(): Date {
    const ttlMinutes = Number(process.env.VIETQR_PAYMENT_TTL_MINUTES || 15);
    const safeTtlMinutes = Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 15;
    return new Date(Date.now() + safeTtlMinutes * 60 * 1000);
  }

  private sanitizeCallback(dto: VietqrCallbackDto): Record<string, unknown> {
    return {
      amount: dto.amount,
      content: dto.content,
      transactionid: dto.transactionid,
      transactiontime: dto.transactiontime,
      referencenumber: dto.referencenumber,
      orderId: dto.orderId,
      transType: dto.transType,
      terminalCode: dto.terminalCode,
    };
  }

  private toPaymentResponse(vietqrTransaction: VietqrTransaction, paymentId: number): VietqrPaymentResponse {
    return {
      paymentId,
      orderId: vietqrTransaction.orderId,
      amount: Number(vietqrTransaction.amount),
      transactionRef: vietqrTransaction.transactionRefId,
      content: vietqrTransaction.content,
      paymentContent: vietqrTransaction.content,
      qrCode: vietqrTransaction.qrCode,
      qrLink: vietqrTransaction.qrLink,
      expiredAt: vietqrTransaction.expiredAt,
      status: vietqrTransaction.status,
      bankCode: process.env.VIETQR_BANK_CODE ?? '',
      bankAccount: process.env.VIETQR_BANK_ACCOUNT ?? '',
      bankAccountName: process.env.VIETQR_BANK_ACCOUNT_NAME ?? '',
    };
  }
}
