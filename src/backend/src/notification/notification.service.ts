import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Subscription } from 'rxjs';
import { Order } from '../order/entities/order.entity';
import { PaymentTransaction } from '../payment/entities/payment-transaction.entity';
import { NotificationEventBus } from './events/notification-event-bus';
import { NotificationEvent } from './events/notification-event';
import {
  NOTIFICATION_PROVIDERS,
  NotificationPayload,
  NotificationProvider,
} from './interfaces/notification-provider.interface';

/**
 * + Coupling/Cohesion level:
 *   - Data Coupling: Receives event payloads and entity structures.
 *   - Functional Cohesion: Dedicated entirely to managing/dispatching notifications based on system events.
 *
 * + SOLID Principles Review:
 *   - SRP Adherence: Chỉ điều phối — nạp dữ liệu sự kiện, dựng payload trung tính, phát cho providers.
 *     Việc render định dạng từng kênh nằm trong provider, không còn ở service.
 *   - OCP Adherence: Thêm kênh mới = thêm provider + đăng ký token, service không đổi.
 *   - DIP Adherence: Phụ thuộc abstraction NotificationProvider (token NOTIFICATION_PROVIDERS) và
 *     payload trung tính, không biết về email/subject/html của bất kỳ kênh nào.
 */
@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private subscription?: Subscription;

  constructor(
    private readonly dataSource: DataSource,
    private readonly eventBus: NotificationEventBus,
    @Inject(NOTIFICATION_PROVIDERS)
    private readonly providers: NotificationProvider[],
  ) {}

  onModuleInit(): void {
    this.logger.log('Notification service subscribed to event bus');
    this.subscription = this.eventBus.events$().subscribe((event) => {
      void this.handle(event);
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async handle(event: NotificationEvent): Promise<void> {
    try {
      this.logger.log(`Handling ${event.type} notification for order #${event.orderId}`);
      const order = await this.loadOrder(event.orderId);
      const paymentTransaction = await this.loadPaymentTransaction(order.orderID, event.paymentTransactionId);
      const payload = this.buildPayload(event, order, paymentTransaction);
      await this.dispatch(payload);
    } catch (error: any) {
      this.logger.error(`Notification event ${event.type} for order #${event.orderId} failed`, error?.stack || error);
    }
  }

  private async loadOrder(orderId: number): Promise<Order> {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { orderID: orderId },
      relations: ['orderItems', 'orderItems.product', 'deliveryInfo', 'invoice'],
    });
    if (!order) {
      throw new Error(`Order #${orderId} not found for notification`);
    }
    return order;
  }

  private async loadPaymentTransaction(
    orderId: number,
    paymentTransactionId?: number,
  ): Promise<PaymentTransaction | null> {
    const repository = this.dataSource.getRepository(PaymentTransaction);
    if (paymentTransactionId) {
      return repository.findOne({
        where: { transactionID: paymentTransactionId },
        relations: ['order'],
      });
    }

    return repository.findOne({
      where: { order: { orderID: orderId }, status: 'SUCCESS' },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Dựng payload trung tính kênh: dữ liệu ngữ nghĩa + link xem/hủy đơn (dùng chung cho mọi kênh).
   * Không chứa gì riêng của một kênh — provider tự render.
   */
  private buildPayload(
    event: NotificationEvent,
    order: Order,
    paymentTransaction: PaymentTransaction | null,
  ): NotificationPayload {
    const appPublicUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:4200').replace(/\/$/, '');
    const tokenQuery = order.customerAccessToken ? `&token=${encodeURIComponent(order.customerAccessToken)}` : '';
    const viewOrder = `${appPublicUrl}/order-detail?orderId=${order.orderID}${tokenQuery}`;
    const cancelOrder = `${viewOrder}&intent=cancel`;

    return {
      order,
      event,
      paymentTransaction,
      urls: { viewOrder, cancelOrder },
    };
  }

  private async dispatch(payload: NotificationPayload): Promise<void> {
    await Promise.all(
      this.providers.map(async (provider) => {
        try {
          await provider.send(payload);
        } catch (error: any) {
          this.logger.error(
            `Notification via ${provider.channel} for order #${payload.order.orderID} failed`,
            this.formatProviderError(error),
          );
        }
      }),
    );
  }

  private formatProviderError(error: any): string {
    const responseBody = error?.response?.body;
    if (responseBody) {
      return JSON.stringify(responseBody);
    }
    return error?.stack || error?.message || String(error);
  }
}
