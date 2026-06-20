export interface IPaypal {
  createOrderInPaypal(orderId: number): Promise<any>;
  captureOrderInPaypal(paypalOrderID: string, orderId: number): Promise<any>;
  refundOrderInPaypal(orderId: number, updateOrderStatus?: boolean): Promise<any>;
}
