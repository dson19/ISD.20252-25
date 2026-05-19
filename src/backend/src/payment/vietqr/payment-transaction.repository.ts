import { PaymentTransaction } from './domain/payment-transaction';

export const PAYMENT_TRANSACTION_REPOSITORY = 'PaymentTransactionRepository';

export interface PaymentTransactionRepository {
  findLatestByStatus(status: string): Promise<PaymentTransaction | null>;
  save(transaction: PaymentTransaction): Promise<PaymentTransaction>;
}
