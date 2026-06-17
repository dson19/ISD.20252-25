import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Subscription } from 'rxjs';
import { Order } from '../order/entities/order.entity';
import { PaymentTransaction } from '../payment/entities/payment-transaction.entity';
import { NotificationEventBus } from './events/notification-event-bus';
import { NotificationEvent } from './events/notification-event';
import {
  NOTIFICATION_PROVIDERS,
  NotificationProvider,
} from './interfaces/notification-provider.interface';
import { EmailTemplateService, RenderedEmail } from './templates/email-template.service';

/**
 * + Coupling/Cohesion level:
 *   - Data Coupling: Receives event payloads and entity structures.
 *   - Functional Cohesion: Dedicated entirely to managing/dispatching notifications based on system events.
 * 
 * + SOLID Principles Review:
 *   - SRP Adherence: Coordinates only event-triggered dispatching. Rendering and sending are delegated.
 *   - OCP Adherence: Event bus driven design and provider registration allow extending notification channels and provider implementations without modifying the service.
 *   - LSP Adherence: Swaps email/SMS providers transparently because they adhere strictly to the NotificationProvider interface.
 *   - ISP Adherence: Relies on the highly cohesive, role-specific NotificationProvider interface.
 *   - DIP Adherence: Depends on the NotificationProvider abstraction injected via the NOTIFICATION_PROVIDERS token instead of hardcoding any specific API client.
 */
@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private subscription?: Subscription;

  constructor(
    private readonly dataSource: DataSource,
    private readonly eventBus: NotificationEventBus,
    private readonly emailTemplateService: EmailTemplateService,
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
      if (!order.deliveryInfo?.email) {
        this.logger.warn(`Notification skipped because order #${event.orderId} has no customer email`);
        return;
      }

      const paymentTransaction = await this.loadPaymentTransaction(order.orderID, event.paymentTransactionId);
      const email = this.renderEmail(event, order, paymentTransaction);
      await this.dispatch(order.deliveryInfo.email, email);
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

  private renderEmail(
    event: NotificationEvent,
    order: Order,
    paymentTransaction: PaymentTransaction | null,
  ): RenderedEmail {
    const appPublicUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:4200').replace(/\/$/, '');
    const tokenQuery = order.customerAccessToken ? `&token=${encodeURIComponent(order.customerAccessToken)}` : '';
    const viewOrderUrl = `${appPublicUrl}/order-detail?orderId=${order.orderID}${tokenQuery}`;
    const cancelOrderUrl = `${viewOrderUrl}&intent=cancel`;
    const context = {
      order,
      paymentTransaction,
      viewOrderUrl,
      cancelOrderUrl,
      refundMethod: event.refundMethod,
      refundStatus: event.refundStatus,
    };

    if (event.type === 'ORDER_PAYMENT_SUCCEEDED') {
      return this.emailTemplateService.renderPaymentSuccess(context);
    }
    if (event.type === 'ORDER_CANCELLED') {
      return this.emailTemplateService.renderCancellation(context);
    }
    return this.emailTemplateService.renderReviewResult(context, event.type === 'ORDER_APPROVED');
  }

  private async dispatch(to: string, email: RenderedEmail): Promise<void> {
    const message = {
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    };
    await Promise.all(
      this.providers.map(async (provider) => {
        try {
          await provider.send(message);
        } catch (error: any) {
          this.logger.error(`Notification via ${provider.channel} to ${to} failed`, this.formatProviderError(error));
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
