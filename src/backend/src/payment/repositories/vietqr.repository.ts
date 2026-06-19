import { Injectable } from '@nestjs/common';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { VietqrTransaction } from '../entities/vietqr-transaction.entity';
import { PaymentTransaction } from '../entities/payment-transaction.entity';

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
 * + Coupling/Cohesion level:
 *   - Data Coupling: Passes clean data parameters and transaction objects to execute save/update operations.
 *   - Communicational Cohesion: Gathers functions that operate exclusively on the `vietqr_transactions` database entity.
 * + Reason why:
 *   - Encapsulating VietQR-specific TypeORM commands inside a separate repository protects core services from SQL or database-specific changes.
 */
@Injectable()
export class VietqrRepository {
  private vietqrRepository: Repository<VietqrTransaction>;

  constructor(private dataSource: DataSource) {
    this.vietqrRepository = this.dataSource.getRepository(VietqrTransaction);
  }

  async createVietqrTransaction(data: CreateVietqrTransactionData): Promise<VietqrTransaction> {
    const paymentTransaction = { transactionID: data.paymentTransactionId } as PaymentTransaction;
    const entity = this.vietqrRepository.create({
      paymentTransaction,
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

  async findPendingByOrderAndAmount(orderId: number, amount: number): Promise<VietqrTransaction | null> {
    return await this.vietqrRepository.findOne({
      where: {
        orderId,
        amount,
        status: 'PENDING',
        expiredAt: MoreThan(new Date()),
      },
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

  async findByContentAndAmount(content: string, amount: number): Promise<VietqrTransaction | null> {
    return await this.vietqrRepository.findOne({
      where: { content, amount },
      order: { vietqrTransactionID: 'DESC' },
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
