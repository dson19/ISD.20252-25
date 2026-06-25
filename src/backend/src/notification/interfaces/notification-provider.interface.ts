import { Order } from '../../order/entities/order.entity';
import { PaymentTransaction } from '../../payment/entities/payment-transaction.entity';
import { NotificationEvent } from '../events/notification-event';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'ZALO' | 'PUSH';

/**
 * Payload TRUNG TÍNH kênh: chỉ chứa dữ liệu ngữ nghĩa của sự kiện (đơn hàng, loại sự kiện,
 * giao dịch, link). KHÔNG mang khái niệm riêng của một kênh (vd subject/html của email).
 * Mỗi provider tự lấy địa chỉ phù hợp (email/phone/...) và tự render định dạng của kênh mình.
 */
export interface NotificationPayload {
  order: Order;
  event: NotificationEvent;
  paymentTransaction: PaymentTransaction | null;
  urls: {
    viewOrder: string;
    cancelOrder: string;
  };
}

export interface NotificationProvider {
  channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<void>;
}

export const NOTIFICATION_PROVIDERS = Symbol('NOTIFICATION_PROVIDERS');
