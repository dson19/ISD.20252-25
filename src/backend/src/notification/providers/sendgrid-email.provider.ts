import { Injectable, Logger } from '@nestjs/common';
import sendgrid from '@sendgrid/mail';
import {
  NotificationPayload,
  NotificationProvider,
} from '../interfaces/notification-provider.interface';
import { EmailTemplateService, OrderEmailContext } from '../templates/email-template.service';

/**
 * Kênh EMAIL. Provider tự chịu trách nhiệm cho mọi thứ riêng của email:
 *   - lấy địa chỉ nhận (order.deliveryInfo.email), tự skip nếu không có;
 *   - chọn template theo loại sự kiện (if/else về event.type sống ở ĐÂY, không ở NotificationService);
 *   - render subject/html/text rồi gửi qua SendGrid.
 * Thêm kênh mới (SMS/Zalo/Push) = thêm provider tương tự, KHÔNG sửa NotificationService.
 */
@Injectable()
export class SendGridEmailProvider implements NotificationProvider {
  readonly channel = 'EMAIL' as const;
  private readonly logger = new Logger(SendGridEmailProvider.name);
  private readonly fromEmail = process.env.SENDGRID_FROM_EMAIL;
  private readonly fromName = process.env.SENDGRID_FROM_NAME || 'AIMS Store';

  constructor(private readonly emailTemplateService: EmailTemplateService) {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sendgrid.setApiKey(apiKey);
    }
  }

  async send(payload: NotificationPayload): Promise<void> {
    const to = payload.order.deliveryInfo?.email;
    if (!to) {
      this.logger.warn(`Email skipped because order #${payload.order.orderID} has no customer email`);
      return;
    }

    if (!process.env.SENDGRID_API_KEY || !this.fromEmail) {
      this.logger.warn('SendGrid email skipped because SENDGRID_API_KEY or SENDGRID_FROM_EMAIL is not configured');
      return;
    }

    const email = this.render(payload);
    const result = await sendgrid.send({
      to,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    const response = Array.isArray(result) ? result[0] : undefined;
    this.logger.log(`SendGrid accepted email to ${to} with status ${response?.statusCode ?? 'unknown'}`);
  }

  private render(payload: NotificationPayload) {
    const context: OrderEmailContext = {
      order: payload.order,
      paymentTransaction: payload.paymentTransaction,
      viewOrderUrl: payload.urls.viewOrder,
      cancelOrderUrl: payload.urls.cancelOrder,
      refundMethod: payload.event.refundMethod,
      refundStatus: payload.event.refundStatus,
    };

    if (payload.event.type === 'ORDER_PAYMENT_SUCCEEDED') {
      return this.emailTemplateService.renderPaymentSuccess(context);
    }
    if (payload.event.type === 'ORDER_CANCELLED') {
      return this.emailTemplateService.renderCancellation(context);
    }
    return this.emailTemplateService.renderReviewResult(context, payload.event.type === 'ORDER_APPROVED');
  }
}
