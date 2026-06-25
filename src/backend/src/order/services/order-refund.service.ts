import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { NotificationEventBus } from '../../notification/events/notification-event-bus';
import { Order } from '../entities/order.entity';
import { OrderRepository } from '../order.repository';

/**
 * + Coupling/Cohesion level:
 *   - Functional Cohesion: Chỉ lo nghiệp vụ XÁC NHẬN HOÀN TIỀN TAY cho các cổng không hoàn tự động
 *     (hiện là VietQR — VietQR không có API hoàn tiền, Product Manager chuyển khoản tay rồi xác nhận).
 * + SOLID Principles Review:
 *   - SRP Adherence: Tách khỏi OrderService — luồng hoàn tiền tay độc lập với vòng đời đặt/duyệt/huỷ.
 *   - DIP Adherence: Dùng OrderRepository (transaction-aware) cho mọi truy cập dữ liệu, không tự viết SQL.
 */
@Injectable()
export class OrderRefundService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly orderRepository: OrderRepository,
    private readonly notificationEventBus: NotificationEventBus,
  ) {}

  async confirmVietqrRefund(orderId: number): Promise<Order> {
    const updatedOrder = await this.dataSource.transaction(async (manager) => {
      const order = await this.findOrderOrFail(orderId, manager);
      if (order.status !== 'REFUND_PENDING') {
        throw new BadRequestException(`Order #${orderId} is in status ${order.status}, not REFUND_PENDING`);
      }

      const transactionId = await this.orderRepository.findVietqrTransactionId(orderId, manager);
      if (!transactionId) {
        throw new BadRequestException(`Order #${orderId} does not have a successful VietQR transaction to refund`);
      }

      await this.orderRepository.markTransactionRefunded(transactionId, manager);

      order.status = 'REFUNDED';
      await this.orderRepository.save(order, manager);
      return order;
    });

    this.notificationEventBus.publish({
      type: 'ORDER_CANCELLED',
      orderId,
      refundMethod: 'VIETQR',
      refundStatus: 'REFUNDED',
    });
    return updatedOrder;
  }

  private async findOrderOrFail(orderId: number, manager?: EntityManager): Promise<Order> {
    const order = await this.orderRepository.findFullById(orderId, manager);
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    return order;
  }
}
