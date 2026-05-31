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
    this.subscription = this.eventBus.events$().subscribe((event) => {
      void this.handle(event);
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async handle(event: NotificationEvent): Promise<void> {
    try {
      const order = await this.loadOrder(event.orderId);
      if (!order.deliveryInfo?.email) {
        this.logger.warn(`Notification skipped because order #${event.orderId} has no customer email`);
        return;
      }

      const paymentTransaction = await this.loadPaymentTransaction(order.orderID, event.paymentTransactionId);
      const email = this.renderEmail(event, order, paymentTransaction);
      await this.dispatchEmail(order.deliveryInfo.email, email);
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

  private async dispatchEmail(to: string, email: RenderedEmail): Promise<void> {
    const emailProviders = this.providers.filter((provider) => provider.channel === 'EMAIL');
    await Promise.all(
      emailProviders.map(async (provider) => {
        try {
          await provider.send({
            to,
            subject: email.subject,
            html: email.html,
            text: email.text,
          });
        } catch (error: any) {
          this.logger.error(`Email notification to ${to} failed`, error?.stack || error);
        }
      }),
    );
  }
}
