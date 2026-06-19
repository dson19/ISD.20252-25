import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { CreateVietqrPaymentDto } from '../dto/create-vietqr-payment.dto';
import { VietqrCallbackDto } from '../dto/vietqr-callback.dto';
import { VietqrTransaction } from '../entities/vietqr-transaction.entity';
import { PaymentRepository } from '../repositories/payment.repository';
import { VietqrApiClient } from '../API/vietqr-api.client';
import { VietqrRepository } from '../repositories/vietqr.repository';
import { NotificationEventBus } from '../../notification/events/notification-event-bus';

export interface VietqrPaymentResponse {
  paymentId: number;
  orderId: number;
  amount: number;
  transactionRef: string | null;
  content: string;
  paymentContent: string;
  qrCode: string | null;
  qrLink: string | null;
  expiredAt: Date;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
  bankCode?: string;
  bankAccount?: string;
  bankAccountName?: string;
}

export interface VietqrCallbackResult {
  status: 'SUCCESS';
  message: 'Callback processed' | 'Callback already processed';
  paymentId: number;
}

/**
 * + Coupling/Cohesion level:
 *   - Data Coupling: Interacts with VietqrRepository and PaymentRepository passing primitive parameters.
 *   - Procedural Cohesion: Orchestrates order status validation, requesting dynamic QR code, and writing transaction logs in sequence.
 *   - Sequential Cohesion: Receives raw webhook callback, parses callback payload, validates transaction reference, updates status, and maps result.
 * + Reason why:
 *   - Bundling state transitions, validations, and callback sync logic keeps the payment process transactional, safe, and easily testable.
 */
@Injectable()
export class VietqrPaymentService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly paymentRepository: PaymentRepository,
    private readonly vietqrRepository: VietqrRepository,
    private readonly vietqrApiClient: VietqrApiClient,
    private readonly notificationEventBus: NotificationEventBus,
  ) { }

  async createPayment(dto: CreateVietqrPaymentDto): Promise<VietqrPaymentResponse> {
    this.validateOrderIdForVietqr(dto.orderId);
    this.validateAmount(dto.amount);
    const content = this.validateAndNormalizeContent(dto.content);

    const order = await this.orderRepository.findOne({
      select: { orderID: true },
      where: { orderID: dto.orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
    }

    // Check if there is an existing pending, non-expired VietQR transaction for this order and amount
    const existingPending = await this.vietqrRepository.findPendingByOrderAndAmount(dto.orderId, dto.amount);
    if (existingPending) {
      return this.toPaymentResponse(existingPending, existingPending.paymentTransaction.transactionID);
    }

    const paymentTransaction = await this.paymentRepository.createTransaction(dto.orderId, dto.amount, 'VIETQR', content);
    try {
      const qrResponse = await this.vietqrApiClient.generateQrCode({
        orderId: String(dto.orderId),
        amount: Math.round(dto.amount),
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
    } catch (error) {
      await this.paymentRepository.updateTransactionStatusIfCurrent(
        paymentTransaction.transactionID,
        'PENDING',
        'FAILED',
      );
      throw error;
    }
  }

  async getStatusByPaymentId(paymentId: number): Promise<VietqrPaymentResponse> {
    const vietqrTransaction = await this.vietqrRepository.findByPaymentTransactionId(paymentId);
    if (!vietqrTransaction) {
      throw new NotFoundException(`VietQR payment ${paymentId} was not found`);
    }

    await this.expireIfNeeded(vietqrTransaction);
    return this.toPaymentResponse(vietqrTransaction, paymentId);
  }

  async getStatusByTransactionRef(transactionRef: string): Promise<VietqrPaymentResponse> {
    const vietqrTransaction = await this.vietqrRepository.findByTransactionRefId(transactionRef);
    if (!vietqrTransaction) {
      throw new NotFoundException(`VietQR transaction reference ${transactionRef} was not found`);
    }

    await this.expireIfNeeded(vietqrTransaction);
    return this.toPaymentResponse(vietqrTransaction, vietqrTransaction.paymentTransaction.transactionID);
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

  async handleCallback(dto: VietqrCallbackDto): Promise<VietqrCallbackResult> {
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
    const transactionRefId = dto.referencenumber.trim() || vietqrTransaction.transactionRefId;
    const changed = await this.vietqrRepository.markPaidIfPending(vietqrTransaction.vietqrTransactionID, {
      transactionId: dto.transactionid,
      transactionRefId,
      paidAt,
      rawCallback: this.sanitizeCallback(dto),
    });

    if (changed) {
      await this.paymentRepository.updateTransactionStatusIfCurrent(
        vietqrTransaction.paymentTransaction.transactionID,
        'PENDING',
        'SUCCESS',
      );
      await this.orderRepository.update(vietqrTransaction.orderId, {
        status: 'PENDING_PROCESSING',
      });
      this.notificationEventBus.publish({
        type: 'ORDER_PAYMENT_SUCCEEDED',
        orderId: vietqrTransaction.orderId,
        paymentTransactionId: vietqrTransaction.paymentTransaction.transactionID,
      });
    }

    return {
      status: 'SUCCESS',
      message: changed ? 'Callback processed' : 'Callback already processed',
      paymentId: vietqrTransaction.paymentTransaction.transactionID,
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

    if (Number(vietqrTransaction.amount) !== Number(dto.amount)) {
      throw new BadRequestException('VietQR callback amount does not match payment');
    }

    const dbContent = (vietqrTransaction.content ?? '').trim().toUpperCase();
    const callbackContent = (dto.content ?? '').trim().toUpperCase();
    if (dbContent !== callbackContent) {
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
    if (!Number.isInteger(amount)) {
      throw new BadRequestException('VietQR amount must be a whole number (no decimals)');
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
