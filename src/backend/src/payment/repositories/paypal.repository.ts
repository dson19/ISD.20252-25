import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PaypalTransaction } from '../entities/paypal-transaction.entity';

/**
 * + Coupling/Cohesion level:
 *   - Data Coupling: Exchanges database parameters and transaction entity structures via repository commands.
 *   - Communicational Cohesion: Handles SQL persistence methods solely targeting the `paypal_transactions` entity.
 * + Reason why:
 *   - Abstracting PayPal-specific database details from the central payment service isolates persistence mapping logic.
 */
@Injectable()
export class PaypalRepository {
  private paypalTxRepository: Repository<PaypalTransaction>;

  constructor(private dataSource: DataSource) {
    this.paypalTxRepository = this.dataSource.getRepository(PaypalTransaction);
  }

  async createPaypalTx(paypalOrderId: string, paymentTxId: number, status: string = 'CREATED'): Promise<PaypalTransaction> {
    const paypalTx = this.paypalTxRepository.create({
      paypalOrderID: paypalOrderId,
      paymentTransaction: { transactionID: paymentTxId } as any,
      status,
    });
    return await this.paypalTxRepository.save(paypalTx);
  }

  async updatePaypalTx(paypalOrderId: string, data: Partial<PaypalTransaction>): Promise<void> {
    await this.paypalTxRepository.update({ paypalOrderID: paypalOrderId }, data);
  }

  async findByPaypalOrderId(paypalOrderId: string): Promise<PaypalTransaction | null> {
    return await this.paypalTxRepository.findOne({
      where: { paypalOrderID: paypalOrderId },
      relations: ['paymentTransaction', 'paymentTransaction.order'],
    });
  }

  async findBySystemOrderId(orderId: number): Promise<PaypalTransaction | null> {
    return await this.paypalTxRepository.findOne({
      where: { 
        paymentTransaction: { order: { orderID: orderId } },
        status: 'COMPLETED'
      },
      relations: ['paymentTransaction', 'paymentTransaction.order'],
      order: { paypalTransactionID: 'DESC' }
    });
  }
}
