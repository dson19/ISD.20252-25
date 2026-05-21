import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Order } from './entities/order.entity';

@Injectable()
export class OrderRepository {
  private repository: Repository<Order>;

  constructor(private dataSource: DataSource) {
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

  async createOrder(orderData: Partial<Order>): Promise<Order> {
    const order = this.repository.create(orderData);
    return this.repository.save(order);
  }

  async findAll(): Promise<Order[]> {
    return this.repository.find({
      relations: ['orderItems'],
      order: { createdAt: 'DESC' },
    });
  }
}
