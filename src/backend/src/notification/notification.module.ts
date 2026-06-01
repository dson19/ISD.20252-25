import { Global, Module } from '@nestjs/common';
import { NotificationEventBus } from './events/notification-event-bus';
import { NOTIFICATION_PROVIDERS } from './interfaces/notification-provider.interface';
import { NotificationService } from './notification.service';
import { SendGridEmailProvider } from './providers/sendgrid-email.provider';
import { EmailTemplateService } from './templates/email-template.service';

@Global()
@Module({
  providers: [
    NotificationEventBus,
    EmailTemplateService,
    SendGridEmailProvider,
    {
      provide: NOTIFICATION_PROVIDERS,
      useFactory: (emailProvider: SendGridEmailProvider) => [emailProvider],
      inject: [SendGridEmailProvider],
    },
    NotificationService,
  ],
  exports: [NotificationEventBus, EmailTemplateService, SendGridEmailProvider, NotificationService],
})
export class NotificationModule {}
