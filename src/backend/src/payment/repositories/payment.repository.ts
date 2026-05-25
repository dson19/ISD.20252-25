import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PaymentTransaction } from '../entities/payment-transaction.entity';

@Injectable()
export class PaymentRepository {
  private transactionRepository: Repository<PaymentTransaction>;

  constructor(private dataSource: DataSource) {
    this.transactionRepository = this.dataSource.getRepository(PaymentTransaction);
  }

  async createTransaction(orderId: number, amount: number, method: 'PAYPAL' | 'VIETQR'): Promise<PaymentTransaction> {
    const newTx = this.transactionRepository.create({
      order: { orderID: orderId },
      amount,
      method: method,
      status: 'PENDING',
    });
    return await this.transactionRepository.save(newTx);
  }

  async updateTransactionStatus(transactionId: number, status: 'SUCCESS' | 'FAILED' | 'REFUNDED'): Promise<void> {
    await this.transactionRepository.update(transactionId, { status });
  }

  async updateTransactionStatusIfCurrent(
    transactionId: number,
    currentStatus: string,
    nextStatus: 'SUCCESS' | 'FAILED' | 'REFUNDED',
  ): Promise<boolean> {
    const result = await this.transactionRepository.update(
      { transactionID: transactionId, status: currentStatus },
      { status: nextStatus },
    );
    return (result.affected ?? 0) > 0;
  }

  async findTransactionById(transactionId: number): Promise<PaymentTransaction | null> {
    return await this.transactionRepository.findOne({
      where: { transactionID: transactionId },
      relations: ['order'],
    });
  }

  async findTransactionByOrderId(orderId: number): Promise<PaymentTransaction | null> {
    return await this.transactionRepository.findOne({
      where: { order: { orderID: orderId } },
      order: { createdAt: 'DESC' },
    });
  }
}
