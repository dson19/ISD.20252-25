import { VietqrCallbackDto } from './dto/vietqr-callback.dto';
import { VietqrTransaction } from './entities/vietqr-transaction.entity';
import { VietqrMerchantCallbackPayload, VietqrPaymentResponse } from './vietqr.types';

/**
 * Lab 11 Design Review
 * Coupling:
 * - Data Coupling with VietQR controllers and service because mapper functions accept only transaction entities and callback fields.
 * - Avoids Control Coupling by not deciding payment state transitions or API routing.
 * - Avoids Stamp Coupling by converting raw merchant payloads into the narrow callback DTO before business logic sees them.
 *
 * Cohesion:
 * - Functional Cohesion because this file only maps VietQR input/output shapes.
 *
 * Reason:
 * - Keeping response and callback normalization outside controllers and service prevents mapping details from spreading across the flow.
 *
 * Improvement Direction:
 * - Replace these functions with explicit response DTO classes if public API documentation is added.
 */
export function toVietqrPaymentResponse(
  vietqrTransaction: VietqrTransaction,
  paymentId: number,
): VietqrPaymentResponse {
  return {
    paymentId,
    orderId: vietqrTransaction.orderId,
    amount: Number(vietqrTransaction.amount),
    transactionRef: vietqrTransaction.transactionRefId,
    content: vietqrTransaction.content,
    paymentContent: vietqrTransaction.content,
    qrCode: vietqrTransaction.qrCode,
    qrLink: vietqrTransaction.qrLink,
    expiredAt: vietqrTransaction.expiredAt,
    status: vietqrTransaction.status,
  };
}

export function toVietqrCallbackDto(payload: VietqrMerchantCallbackPayload): VietqrCallbackDto {
  return {
    bankaccount: String(payload.bankaccount ?? payload.bankAccount ?? ''),
    amount: Number(payload.amount),
    transType: String(payload.transType ?? '') as 'C' | 'D',
    content: String(payload.content ?? ''),
    transactionid: String(payload.transactionid ?? payload.transactionId ?? ''),
    transactiontime: Number(payload.transactiontime ?? payload.transactionTime),
    referencenumber: String(payload.referencenumber ?? payload.referenceNumber ?? ''),
    orderId: String(payload.orderId ?? payload.orderid ?? ''),
    terminalCode:
      payload.terminalCode === undefined || payload.terminalCode === null ? undefined : String(payload.terminalCode),
    sign: payload.sign === undefined || payload.sign === null ? undefined : String(payload.sign),
  };
}
