import { Injectable, Logger } from '@nestjs/common';
import sendgrid from '@sendgrid/mail';
import { NotificationMessage, NotificationProvider } from '../interfaces/notification-provider.interface';

@Injectable()
export class SendGridEmailProvider implements NotificationProvider {
  readonly channel = 'EMAIL' as const;
  private readonly logger = new Logger(SendGridEmailProvider.name);
  private readonly fromEmail = process.env.SENDGRID_FROM_EMAIL;
  private readonly fromName = process.env.SENDGRID_FROM_NAME || 'AIMS Store';

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sendgrid.setApiKey(apiKey);
    }
  }

  async send(message: NotificationMessage): Promise<void> {
    if (!process.env.SENDGRID_API_KEY || !this.fromEmail) {
      this.logger.warn('SendGrid email skipped because SENDGRID_API_KEY or SENDGRID_FROM_EMAIL is not configured');
      return;
    }

    const result = await sendgrid.send({
      to: message.to,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    const response = Array.isArray(result) ? result[0] : undefined;
    this.logger.log(`SendGrid accepted email to ${message.to} with status ${response?.statusCode ?? 'unknown'}`);
  }
}
