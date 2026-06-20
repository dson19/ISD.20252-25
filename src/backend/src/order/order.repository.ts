import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { Order } from './entities/order.entity';

@Injectable()
export class OrderRepository {
  private readonly repository: Repository<Order>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Order);
  }

  async findById(id: number): Promise<Order | null> {
    return this.repository.findOne({
      where: { orderID: id },
      relations: ['orderItems', 'deliveryInfo', 'invoice'],
    });
  }

  async findByStatus(status: string): Promise<Order[]> {
    return this.repository.find({
      where: { status },
      relations: ['orderItems'],
    });
  }

  async updateStatus(id: number, status: string): Promise<void> {
    await this.repository.update(id, { status });
  }

  async findAll(): Promise<Order[]> {
    return this.repository.find({
      relations: ['orderItems'],
      order: { createdAt: 'DESC' },
    });
  }

  async findFullById(orderId: number, manager?: EntityManager): Promise<Order | null> {
    const mgr = manager ?? this.dataSource.manager;
    return mgr.findOne(Order, {
      where: { orderID: orderId },
      relations: ['orderItems', 'orderItems.product', 'deliveryInfo', 'invoice'],
    });
  }

  async findByToken(orderId: number, token: string): Promise<Order | null> {
    return this.repository.findOne({
      where: { orderID: orderId, customerAccessToken: token },
      relations: ['orderItems', 'orderItems.product', 'deliveryInfo', 'invoice'],
    });
  }

  async save(order: Order, manager?: EntityManager): Promise<Order> {
    if (manager) return manager.save(Order, order);
    return this.repository.save(order);
  }

  buildPendingQuery(): SelectQueryBuilder<Order> {
    return this.repository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .leftJoinAndSelect('orderItems.product', 'product')
      .leftJoinAndSelect('order.deliveryInfo', 'deliveryInfo')
      .leftJoinAndSelect('order.invoice', 'invoice')
      .where('order.status IN (:...statuses)', { statuses: ['PENDING', 'PENDING_PROCESSING'] })
      .orderBy('order.status', 'DESC')
      .addOrderBy('order.createdAt', 'ASC');
  }

  buildRefundPendingQuery(): SelectQueryBuilder<Order> {
    return this.repository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .leftJoinAndSelect('orderItems.product', 'product')
      .leftJoinAndSelect('order.deliveryInfo', 'deliveryInfo')
      .leftJoinAndSelect('order.invoice', 'invoice')
      .where('order.status = :status', { status: 'REFUND_PENDING' })
      .orderBy('order.createdAt', 'ASC');
  }

  async getSuccessfulPaymentInfo(
    orderId: number,
    manager: EntityManager,
  ): Promise<{ transaction_id: number; method: string } | null> {
    const txs = await manager.query(
      'SELECT transaction_id, method FROM payment_transactions WHERE order_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [orderId, 'SUCCESS'],
    );
    return txs.length > 0 ? txs[0] : null;
  }

  async getLatestSuccessfulPaymentMethods(orderIds: number[]): Promise<Record<number, string>> {
    const map: Record<number, string> = {};
    if (orderIds.length === 0) return map;

    const txs = await this.dataSource.manager.query(
      `SELECT DISTINCT ON (order_id) order_id, method
       FROM payment_transactions
       WHERE order_id = ANY($1) AND status = $2
       ORDER BY order_id, created_at DESC`,
      [orderIds, 'SUCCESS'],
    );
    for (const tx of txs) {
      map[tx.order_id] = tx.method;
    }
    return map;
  }

  async findVietqrTransactionId(orderId: number, manager: EntityManager): Promise<string | null> {
    const txs = await manager.query(
      'SELECT transaction_id FROM payment_transactions WHERE order_id = $1 AND method = $2 AND status = $3 LIMIT 1',
      [orderId, 'VIETQR', 'SUCCESS'],
    );
    return txs.length > 0 ? String(txs[0].transaction_id) : null;
  }

  async markTransactionRefunded(transactionId: string, manager: EntityManager): Promise<void> {
    await manager.query(
      'UPDATE payment_transactions SET status = $1 WHERE transaction_id = $2',
      ['REFUNDED', transactionId],
    );
  }
}
