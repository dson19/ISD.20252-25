import { Injectable, BadRequestException } from '@nestjs/common';
import { PaypalRepository } from '../repositories/paypal.repository';
import { PaypalApiClient } from '../API/paypal-api-client';
import {
  CreditCardCaptureResult,
  IPaymentCreditCard,
} from '../interfaces/payment-creditcard.interface';

/**
 * + Coupling/Cohesion level:
 *   - Data Coupling: Trao đổi tham số nguyên thủy với PaypalApiClient và PaypalRepository.
 *   - Functional Cohesion: CHỈ lo việc đặc thù cổng PayPal — gọi PayPal REST API và ghi PaypalTransaction
 *     (kho riêng của cổng). KHÔNG đụng PaymentTransaction (bảng chung) / Order / notification.
 *
 * + SOLID Principles Review:
 *   - SRP Adherence: Adapter cổng thuần. Vòng đời PaymentTransaction + cập nhật Order + publish do
 *     PaymentService điều phối; service này chỉ là "tay" gọi PayPal.
 *   - LSP/ISP Adherence: implements IPaymentCreditCard — interface riêng cho modality thẻ tín dụng
 *     (có capture + refund tự động), không bị ép vào một interface chung gượng ép.
 */
@Injectable()
export class PaypalService implements IPaymentCreditCard {
  readonly method = 'PAYPAL';

  constructor(
    private readonly paypalRepository: PaypalRepository,
    private readonly paypalApiClient: PaypalApiClient,
  ) { }

  /**
   * Tạo đơn phía PayPal + ghi PaypalTransaction liên kết paymentTransactionId (do PaymentService tạo trước).
   * Quy đổi VND→USD là việc đặc thù của cổng nên nằm tại đây.
   */
  async createOrder(orderId: number, amount: number, paymentTransactionId: number): Promise<any> {
    // Quy đổi từ VND sang USD (Tỷ giá giả định 1 USD = 25,000 VND)
    const usdAmount = (amount / 25000).toFixed(2);

    try {
      const paypalOrder = await this.paypalApiClient.createOrder(orderId, usdAmount);

      await this.paypalRepository.createPaypalTx(paypalOrder.id, paymentTransactionId, paypalOrder.status);

      const approveLink = paypalOrder.links.find((l: any) => l.rel === 'approve')?.href;

      return {
        paypalOrderID: paypalOrder.id,
        status: paypalOrder.status,
        approveUrl: approveLink,
      };
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Error occurred while creating PayPal order');
    }
  }

  /**
   * Chủ động capture tiền. Chỉ ghi PaypalTransaction; trả kết quả chuẩn hoá để PaymentService
   * cập nhật PaymentTransaction + Order + publish (onPaymentConfirmed).
   */
  async captureOrder(gatewayOrderId: string, _orderId: number): Promise<CreditCardCaptureResult> {
    try {
      const captureData = await this.paypalApiClient.captureOrder(gatewayOrderId);
      const status = captureData.status;

      if (status !== 'COMPLETED') {
        return { completed: false, paymentTransactionId: null, raw: captureData };
      }

      const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      await this.paypalRepository.updatePaypalTx(gatewayOrderId, {
        paypalCaptureID: captureId,
        status,
      });

      const paypalTx = await this.paypalRepository.findByPaypalOrderId(gatewayOrderId);
      return {
        completed: true,
        paymentTransactionId: paypalTx?.paymentTransaction?.transactionID ?? null,
        raw: captureData,
      };
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Error occurred while capturing PayPal order');
    }
  }

  /**
   * Hoàn tiền tự động qua PayPal API. Chỉ cập nhật PaypalTransaction phía cổng;
   * PaymentService lo cập nhật PaymentTransaction (REFUNDED). Order-status khi huỷ đơn do OrderService lo.
   */
  async refund(orderId: number): Promise<any> {
    const paypalTx = await this.paypalRepository.findBySystemOrderId(orderId);
    if (!paypalTx || !paypalTx.paypalCaptureID) {
      throw new BadRequestException(`No successful PayPal capture found for order ID ${orderId}`);
    }

    try {
      const refundData = await this.paypalApiClient.refundCapture(paypalTx.paypalCaptureID, orderId);
      await this.paypalRepository.updatePaypalTx(paypalTx.paypalOrderID, { status: 'REFUNDED' });
      return refundData;
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Error occurred while refunding PayPal order');
    }
  }
}
