import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { VietqrTransaction } from './entities/vietqr-transaction.entity';

export interface CreateVietqrTransactionData {
  paymentTransactionId: number;
  orderId: number;
  amount: number;
  content: string;
  qrCode: string | null;
  qrLink: string | null;
  transactionId: string | null;
  transactionRefId: string | null;
  expiredAt: Date;
}

export interface MarkVietqrPaidData {
  transactionId: string;
  transactionRefId: string | null;
  paidAt: Date;
  rawCallback: Record<string, unknown>;
}

/**
 * Lab 11 Design Review
 * Coupling:
 * - Data Coupling with VietqrPaymentService because persistence methods accept only VietQR payment fields required for storage.
 * - Avoids Control Coupling by not deciding payment state transitions outside the requested repository operation.
 * - Avoids Stamp Coupling by not accepting full DTOs or raw external API responses as method inputs.
 *
 * Cohesion:
 * - Functional Cohesion because this class only persists and retrieves VietQR transaction records.
 *
 * Reason:
 * - VietQR storage stays isolated from HTTP routing, external API calls, and PayPal persistence.
 *
 * Improvement Direction:
 * - Add database transactions around paired payment/VietQR updates if multi-step consistency becomes a production requirement.
 */
@Injectable()
export class VietqrRepository {
  private vietqrRepository: Repository<VietqrTransaction>;

  constructor(private dataSource: DataSource) {
    this.vietqrRepository = this.dataSource.getRepository(VietqrTransaction);
  }

  async createVietqrTransaction(data: CreateVietqrTransactionData): Promise<VietqrTransaction> {
    const entity = this.vietqrRepository.create({
      paymentTransaction: { transactionID: data.paymentTransactionId } as any,
      orderId: data.orderId,
      amount: data.amount,
      content: data.content,
      qrCode: data.qrCode,
      qrLink: data.qrLink,
      transactionId: data.transactionId,
      transactionRefId: data.transactionRefId,
      expiredAt: data.expiredAt,
      paidAt: null,
      status: 'PENDING',
      rawCallback: null,
    });

    return await this.vietqrRepository.save(entity);
  }

  async findByPaymentTransactionId(paymentTransactionId: number): Promise<VietqrTransaction | null> {
    return await this.vietqrRepository.findOne({
      where: { paymentTransaction: { transactionID: paymentTransactionId } },
      relations: ['paymentTransaction'],
    });
  }

  async findByTransactionRefId(transactionRefId: string): Promise<VietqrTransaction | null> {
    return await this.vietqrRepository.findOne({
      where: { transactionRefId },
      relations: ['paymentTransaction'],
    });
  }

  async findByContentOrderAndAmount(content: string, orderId: number, amount: number): Promise<VietqrTransaction | null> {
    return await this.vietqrRepository.findOne({
      where: { content, orderId, amount },
      relations: ['paymentTransaction'],
    });
  }

  async markExpired(vietqrTransactionId: number): Promise<void> {
    await this.vietqrRepository.update(vietqrTransactionId, { status: 'EXPIRED' });
  }

  async markPaidIfPending(vietqrTransactionId: number, data: MarkVietqrPaidData): Promise<boolean> {
    const result = await this.vietqrRepository.update(
      { vietqrTransactionID: vietqrTransactionId, status: 'PENDING' },
      {
        status: 'PAID',
        transactionId: data.transactionId,
        transactionRefId: data.transactionRefId,
        paidAt: data.paidAt,
        rawCallback: data.rawCallback as any,
      },
    );

    return (result.affected ?? 0) > 0;
  }
}
