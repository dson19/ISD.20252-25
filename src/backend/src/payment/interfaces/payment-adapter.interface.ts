/**
 * Adapter Pattern: standardises the interface AIMS uses to talk to any third-party
 * payment gateway, regardless of each provider's own SDK shape.
 *
 * ISP/LSP: refund capability is segregated into a separate IRefundableAdapter.
 * A gateway without a refund API (e.g. VietQR) implements only IPaymentAdapter and
 * therefore is never asked to perform a refund it cannot honour.
 */
export interface IPaymentAdapter {
  /** Discriminator used to resolve the adapter by payment method (e.g. 'PAYPAL', 'VIETQR'). */
  readonly method: string;
  createPaymentRequest(orderId: number, amount: number): Promise<any>;
}

/** Adapters for gateways that expose an automated refund API. */
export interface IRefundableAdapter extends IPaymentAdapter {
  executeRefund(transaction: any, amount: number): Promise<any>;
}

/** Type guard: narrows an adapter to one that can refund automatically. */
export function isRefundable(
  adapter: IPaymentAdapter,
): adapter is IRefundableAdapter {
  return typeof (adapter as IRefundableAdapter).executeRefund === 'function';
}

/** DI token carrying every registered payment adapter (composition root supplies the array). */
export const PAYMENT_ADAPTERS = Symbol('PAYMENT_ADAPTERS');
