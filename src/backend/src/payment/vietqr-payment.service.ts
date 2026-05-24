import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateVietqrPaymentDto } from './dto/create-vietqr-payment.dto';
import { VietqrCallbackDto } from './dto/vietqr-callback.dto';
import { VietqrTransaction } from './entities/vietqr-transaction.entity';
import { PaymentRepository } from './payment.repository';
import { VietqrApiClient } from './vietqr-api.client';
import { VietqrRepository } from './vietqr.repository';

/**
 * Lab 11 Design Review
 * Coupling:
 * - Data Coupling with VietqrController, VietqrRepository, PaymentRepository, and VietqrApiClient through narrow DTOs and scalar ids.
 * - Avoids Control Coupling by providing dedicated VietQR methods instead of gateway selection flags or payment-method switches.
 * - Avoids Stamp Coupling by not receiving whole Order, Cart, Checkout, or Shipping objects.
 *
 * Cohesion:
 * - Functional Cohesion because this class owns only the VietQR PayOrder business flow.
 *
 * Reason:
 * - Payment orchestration belongs in a service, while HTTP routing, database access, and external API mapping stay in separate classes.
 *
 * Improvement Direction:
 * - Add signature verification once the merchant account provides a callback signing secret.
 */
@Injectable()
export class VietqrPaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly vietqrRepository: VietqrRepository,
    private readonly vietqrApiClient: VietqrApiClient,
  ) {}

  async createPayment(dto: CreateVietqrPaymentDto) {
    this.validateOrderIdForVietqr(dto.orderId);
    this.validateAmount(dto.amount);

    const paymentTransaction = await this.paymentRepository.createTransaction(dto.orderId, dto.amount, 'VIETQR');
    const content = this.buildPaymentContent(dto.paymentContent, dto.orderId, paymentTransaction.transactionID);
    const qrResponse = await this.vietqrApiClient.generateQrCode({
      orderId: String(dto.orderId),
      amount: dto.amount,
      content,
    });
    const expiredAt = this.calculateExpiredAt();

    const vietqrTransaction = await this.vietqrRepository.createVietqrTransaction({
      paymentTransactionId: paymentTransaction.transactionID,
      orderId: dto.orderId,
      amount: dto.amount,
      content,
      qrCode: qrResponse.qrCode,
      qrLink: qrResponse.qrLink,
      transactionId: qrResponse.transactionId,
      transactionRefId: qrResponse.transactionRefId,
      expiredAt,
    });

    return this.toPaymentResponse(vietqrTransaction, paymentTransaction.transactionID);
  }

  async getStatusByPaymentId(paymentId: number) {
    const vietqrTransaction = await this.vietqrRepository.findByPaymentTransactionId(paymentId);
    if (!vietqrTransaction) {
      throw new NotFoundException(`VietQR payment ${paymentId} was not found`);
    }

    await this.expireIfNeeded(vietqrTransaction);
    return this.toPaymentResponse(vietqrTransaction, paymentId);
  }

  async getStatusByTransactionRef(transactionRef: string) {
    const vietqrTransaction = await this.vietqrRepository.findByTransactionRefId(transactionRef);
    if (!vietqrTransaction) {
      throw new NotFoundException(`VietQR transaction reference ${transactionRef} was not found`);
    }

    await this.expireIfNeeded(vietqrTransaction);
    return this.toPaymentResponse(vietqrTransaction, vietqrTransaction.paymentTransaction.transactionID);
  }

  async handleCallback(dto: VietqrCallbackDto) {
    if (dto.transType !== 'C') {
      throw new BadRequestException('Only credit VietQR callbacks can mark a payment as paid');
    }

    const vietqrTransaction = await this.findCallbackTarget(dto);
    this.validateCallback(vietqrTransaction, dto);

    if (vietqrTransaction.status === 'PAID') {
      return {
        status: 'SUCCESS',
        message: 'Callback already processed',
        paymentId: vietqrTransaction.paymentTransaction.transactionID,
      };
    }

    if (vietqrTransaction.status !== 'PENDING') {
      throw new BadRequestException(`VietQR payment is ${vietqrTransaction.status}`);
    }

    const paidAt = new Date(dto.transactiontime);
    const changed = await this.vietqrRepository.markPaidIfPending(vietqrTransaction.vietqrTransactionID, {
      transactionId: dto.transactionid,
      transactionRefId: dto.referencenumber,
      paidAt,
      rawCallback: this.sanitizeCallback(dto),
    });

    if (changed) {
      await this.paymentRepository.updateTransactionStatusIfCurrent(
        vietqrTransaction.paymentTransaction.transactionID,
        'PENDING',
        'SUCCESS',
      );
    }

    return {
      status: 'SUCCESS',
      message: changed ? 'Callback processed' : 'Callback already processed',
      paymentId: vietqrTransaction.paymentTransaction.transactionID,
    };
  }

  private async findCallbackTarget(dto: VietqrCallbackDto): Promise<VietqrTransaction> {
    const byReference = await this.vietqrRepository.findByTransactionRefId(dto.referencenumber);
    if (byReference) {
      return byReference;
    }

    const byContent = await this.vietqrRepository.findByContent(dto.content);
    if (byContent) {
      return byContent;
    }

    throw new NotFoundException('Matching VietQR payment was not found');
  }

  private validateCallback(vietqrTransaction: VietqrTransaction, dto: VietqrCallbackDto): void {
    if (String(vietqrTransaction.orderId) !== dto.orderId) {
      throw new BadRequestException('VietQR callback orderId does not match payment');
    }

    if (Number(vietqrTransaction.amount) !== Number(dto.amount)) {
      throw new BadRequestException('VietQR callback amount does not match payment');
    }

    if (vietqrTransaction.content !== dto.content) {
      throw new BadRequestException('VietQR callback content does not match payment');
    }
  }

  private async expireIfNeeded(vietqrTransaction: VietqrTransaction): Promise<void> {
    if (vietqrTransaction.status !== 'PENDING' || vietqrTransaction.expiredAt.getTime() > Date.now()) {
      return;
    }

    await this.vietqrRepository.markExpired(vietqrTransaction.vietqrTransactionID);
    await this.paymentRepository.updateTransactionStatusIfCurrent(
      vietqrTransaction.paymentTransaction.transactionID,
      'PENDING',
      'FAILED',
    );
    vietqrTransaction.status = 'EXPIRED';
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

  private buildPaymentContent(paymentContent: string | undefined, orderId: number, paymentId: number): string {
    const content = paymentContent?.trim() || `AIMS${orderId}P${paymentId}`;
    if (content.length > 23 || !/^[A-Za-z0-9 ]+$/.test(content)) {
      throw new BadRequestException('VietQR payment content must be at most 23 non-accented alphanumeric characters');
    }

    return content;
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

  private toPaymentResponse(vietqrTransaction: VietqrTransaction, paymentId: number) {
    return {
      paymentId,
      orderId: vietqrTransaction.orderId,
      amount: Number(vietqrTransaction.amount),
      transactionRef: vietqrTransaction.transactionRefId,
      paymentContent: vietqrTransaction.content,
      qrCode: vietqrTransaction.qrCode,
      qrLink: vietqrTransaction.qrLink,
      expiredAt: vietqrTransaction.expiredAt,
      status: vietqrTransaction.status,
    };
  }
}
