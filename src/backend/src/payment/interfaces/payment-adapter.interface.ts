export interface IPaymentAdapter {
  createPaymentRequest(orderId: number, amount: number): Promise<any>;
  executeRefund(transaction: any, amount: number): Promise<any>;
}
