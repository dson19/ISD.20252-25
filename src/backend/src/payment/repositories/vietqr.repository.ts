import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
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
