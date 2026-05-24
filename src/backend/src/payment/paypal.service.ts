import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentRepository } from './payment.repository';
import { PaypalRepository } from './paypal.repository';
import { OrderRepository } from '../order/order.repository';
import { PaypalApiClient } from './paypal-api-client';

/**
 * PaypalService - Xử lý nghiệp vụ thanh toán qua PayPal của hệ thống.
 * 
 * ĐỘ GẮN KẾT (COHESION): High Functional Cohesion
 * Lớp này chỉ tập trung vào nghiệp vụ thanh toán của hệ thống (ghi nhận giao dịch, cập nhật DB,
 * cập nhật trạng thái đơn hàng). Đã bóc tách toàn bộ logic kết nối hạ tầng HTTP API sang PaypalApiClient.
 * 
 * SỰ LIÊN KẾT (COUPLING): Low Coupling
 * Bằng cách ủy thác việc giao tiếp API PayPal cho PaypalApiClient, lớp này không trực tiếp phụ thuộc
 * vào chi tiết triển khai gọi fetch hay cấu hình credentials của PayPal.
 */
@Injectable()
export class PaypalService {
    constructor(
        private readonly paymentRepository: PaymentRepository,
        private readonly paypalRepository: PaypalRepository,
        private readonly orderRepository: OrderRepository,
        private readonly paypalApiClient: PaypalApiClient,
    ) { }

    async createOrderInPaypal(orderId: number) {
        const order = await this.orderRepository.findById(orderId);
        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        // Quy đổi từ VND sang USD (Tỷ giá giả định 1 USD = 25,000 VND)
        const vndAmount = Number(order.totalPayment);
        const usdAmount = (vndAmount / 25000).toFixed(2);

        try {
            const paypalOrder = await this.paypalApiClient.createOrder(orderId, usdAmount);

            const paymentTx = await this.paymentRepository.createTransaction(orderId, vndAmount, 'PAYPAL');

            await this.paypalRepository.createPaypalTx(paypalOrder.id, paymentTx.transactionID, paypalOrder.status);

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

    async captureOrderInPaypal(paypalOrderID: string, orderId: number) {
        try {
            const captureData = await this.paypalApiClient.captureOrder(paypalOrderID);
            const status = captureData.status;

            if (status === 'COMPLETED') {
                const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;

                await this.paypalRepository.updatePaypalTx(paypalOrderID, {
                    paypalCaptureID: captureId,
                    status: status,
                });

                const paypalTx = await this.paypalRepository.findByPaypalOrderId(paypalOrderID);
                if (paypalTx && paypalTx.paymentTransaction) {
                    await this.paymentRepository.updateTransactionStatus(
                        paypalTx.paymentTransaction.transactionID,
                        'SUCCESS',
                    );
                }

                await this.orderRepository.updateStatus(orderId, 'PENDING_PROCESSING');
            }

            return captureData;
        } catch (err: any) {
            throw new BadRequestException(err.message || 'Error occurred while capturing PayPal order');
        }
    }

    async refundOrderInPaypal(orderId: number) {
        // Tìm giao dịch PayPal thành công của đơn hàng này
        const paypalTx = await this.paypalRepository.findBySystemOrderId(orderId);
        if (!paypalTx || !paypalTx.paypalCaptureID) {
            throw new BadRequestException(`No successful PayPal capture found for order ID ${orderId}`);
        }

        try {
            const refundData = await this.paypalApiClient.refundCapture(paypalTx.paypalCaptureID, orderId);

            await this.paypalRepository.updatePaypalTx(paypalTx.paypalOrderID, {
                status: 'REFUNDED',
            });

            if (paypalTx.paymentTransaction) {
                await this.paymentRepository.updateTransactionStatus(
                    paypalTx.paymentTransaction.transactionID,
                    'REFUNDED',
                );
            }

            await this.orderRepository.updateStatus(orderId, 'CANCELLED');

            return refundData;
        } catch (err: any) {
            throw new BadRequestException(err.message || 'Error occurred while refunding PayPal order');
        }
    }
}