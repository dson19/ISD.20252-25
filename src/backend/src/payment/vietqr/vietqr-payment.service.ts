import { Inject, Injectable } from '@nestjs/common';
import { TransactionNotFoundException } from '../exceptions/exceptions';
import { PaymentStatus } from './domain/payment-status';
import { PaymentTransaction } from './domain/payment-transaction';
import { InvalidAmountException } from './exceptions/vietqr.exceptions';
import { PAYMENT_TRANSACTION_REPOSITORY } from './payment-transaction.repository';
import type { PaymentTransactionRepository } from './payment-transaction.repository';

@Injectable()
export class VietQRPaymentService {
  constructor(
    @Inject(PAYMENT_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: PaymentTransactionRepository,
  ) {}

  async createTransaction(
    invoiceId: number,
    amount: number,
    method: string,
  ): Promise<PaymentTransaction> {
    if (amount <= 0) {
      throw new InvalidAmountException();
    }

    const transaction = PaymentTransaction.create(invoiceId, amount, method);

    return this.transactionRepository.save(transaction);
  }

  async processPaymentResult(
    callbackStatus: 'SUCCESS' | 'FAILED',
    currentOrderState: string,
  ): Promise<PaymentTransaction> {
    const transaction =
      await this.transactionRepository.findLatestByStatus(currentOrderState);

    if (!transaction) {
      throw new TransactionNotFoundException(
        'TransactionNotFoundException: Pending VietQR transaction not found',
      );
    }

    const paymentStatus = PaymentStatus.fromCallback(
      callbackStatus,
      currentOrderState,
    );
    transaction.updateStatus(paymentStatus.status);

    return this.transactionRepository.save(transaction);
  }
}
