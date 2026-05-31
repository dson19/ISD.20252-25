export type NotificationChannel = 'EMAIL' | 'SMS' | 'ZALO' | 'PUSH';

export interface NotificationMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface NotificationProvider {
  channel: NotificationChannel;
  send(message: NotificationMessage): Promise<void>;
}

export const NOTIFICATION_PROVIDERS = Symbol('NOTIFICATION_PROVIDERS');
