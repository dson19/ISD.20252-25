import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import { Invoice } from '../order/entities/invoice.entity';

@Injectable()
export class PaymentRepository {
  private orderRepository: Repository<Order>;
  private invoiceRepository: Repository<Invoice>;

  constructor(private dataSource: DataSource) {
    this.orderRepository = this.dataSource.getRepository(Order);
    this.invoiceRepository = this.dataSource.getRepository(Invoice);
  }

  async findOrderById(orderId: number): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { orderID: orderId },
    });
  }

  async createInvoice(invoiceData: Partial<Invoice>): Promise<Invoice> {
    const invoice = this.invoiceRepository.create(invoiceData);
    return this.invoiceRepository.save(invoice);
  }

  async updateOrderStatus(orderId: number, status: string): Promise<void> {
    await this.orderRepository.update(orderId, { status });
  }

  async getInvoiceByOrderId(orderId: number): Promise<Invoice | null> {
    return this.invoiceRepository.findOne({
      where: { order: { orderID: orderId } },
      relations: ['order'],
    });
  }
}
