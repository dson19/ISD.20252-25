export type NotificationEventType =
  | 'ORDER_PAYMENT_SUCCEEDED'
  | 'ORDER_CANCELLED'
  | 'ORDER_APPROVED'
  | 'ORDER_REJECTED';

export interface NotificationEvent {
  type: NotificationEventType;
  orderId: number;
  paymentTransactionId?: number;
  refundMethod?: string | null;
  refundStatus?: string | null;
}
