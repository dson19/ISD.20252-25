import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentRepository } from './payment.repository';
import { PaypalRepository } from './paypal.repository';
import { OrderRepository } from '../order/order.repository';

@Injectable()
export class PaypalService {
    constructor(
        private readonly paymentRepository: PaymentRepository,
        private readonly paypalRepository: PaypalRepository,
        private readonly orderRepository: OrderRepository,
    ) { }

    private getPaypalConfig() {
        const clientId = process.env.PAYPAL_CLIENT_ID;
        const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
        const apiBaseUrl = process.env.PAYPAL_API_BASE_URL || 'https://api-m.sandbox.paypal.com';

        if (!clientId || !clientSecret) {
            throw new BadRequestException('PayPal API credentials are not configured in environment variables');
        }

        return { clientId, clientSecret, apiBaseUrl };
    }

    async getAccessToken(): Promise<string> {
        const { clientId, clientSecret, apiBaseUrl } = this.getPaypalConfig();
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        try {
            const response = await fetch(`${apiBaseUrl}/v1/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'grant_type=client_credentials',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new BadRequestException(`Failed to retrieve PayPal access token: ${JSON.stringify(errorData)}`);
            }

            const data: any = await response.json();
            return data.access_token;
        } catch (err: any) {
            throw new BadRequestException(err.message || 'Error occurred while fetching PayPal token');
        }
    }

    async createOrderInPaypal(orderId: number) {
        const order = await this.orderRepository.findById(orderId);
        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        const { apiBaseUrl } = this.getPaypalConfig();
        const accessToken = await this.getAccessToken();

        // Quy đổi từ VND sang USD (Tỷ giá giả định 1 USD = 25,000 VND)
        const vndAmount = Number(order.totalPayment);
        const usdAmount = (vndAmount / 25000).toFixed(2);

        try {
            const response = await fetch(`${apiBaseUrl}/v2/checkout/orders`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    intent: 'CAPTURE',
                    purchase_units: [
                        {
                            reference_id: orderId.toString(),
                            amount: {
                                currency_code: 'USD',
                                value: usdAmount,
                            },
                            description: `Payment for Order #${orderId} in AIMS Store`,
                        },
                    ],
                    application_context: {
                        brand_name: 'AIMS Store',
                        landing_page: 'NO_PREFERENCE',
                        user_action: 'PAY_NOW',
                    },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new BadRequestException(`PayPal create order failed: ${JSON.stringify(errorData)}`);
            }

            const paypalOrder: any = await response.json();

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
        const { apiBaseUrl } = this.getPaypalConfig();
        const accessToken = await this.getAccessToken();

        try {
            const response = await fetch(`${apiBaseUrl}/v2/checkout/orders/${paypalOrderID}/capture`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new BadRequestException(`PayPal capture order failed: ${JSON.stringify(errorData)}`);
            }

            const captureData: any = await response.json();
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
        const { apiBaseUrl } = this.getPaypalConfig();
        const accessToken = await this.getAccessToken();

        // Tìm giao dịch PayPal thành công của đơn hàng này
        const paypalTx = await this.paypalRepository.findBySystemOrderId(orderId);
        if (!paypalTx || !paypalTx.paypalCaptureID) {
            throw new BadRequestException(`No successful PayPal capture found for order ID ${orderId}`);
        }

        try {
            const response = await fetch(`${apiBaseUrl}/v2/payments/captures/${paypalTx.paypalCaptureID}/refund`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    note_to_payer: `Refund for cancelled order #${orderId}`,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new BadRequestException(`PayPal refund failed: ${JSON.stringify(errorData)}`);
            }

            const refundData: any = await response.json();

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