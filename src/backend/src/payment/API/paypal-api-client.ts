import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * + Coupling/Cohesion level:
 *   - Common Coupling: PaypalApiClient reads sandbox credentials from the global `process.env`.
 *   - Data Coupling: Interacts with PaypalService by passing primitive scalar parameters like `orderId` and `usdAmount`.
 *   - Functional Cohesion: Focuses solely on executing external HTTP calls to the PayPal REST API.
 * + Reason why:
 *   - Isolating remote API communications from local databases and route handlers guarantees a highly mockable and single-purpose client.
 */
@Injectable()
export class PaypalApiClient {
    private getFrontendUrl(): string {
        return (process.env.APP_PUBLIC_URL || 'http://localhost:4200').replace(/\/$/, '');
    }

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

    async createOrder(orderId: number, usdAmount: string): Promise<any> {
        const { apiBaseUrl } = this.getPaypalConfig();
        const accessToken = await this.getAccessToken();
        const frontendUrl = this.getFrontendUrl();

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
                        return_url: `${frontendUrl}/payment?orderId=${orderId}&success=true`,
                        cancel_url: `${frontendUrl}/payment?orderId=${orderId}&cancel=true`,
                    },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new BadRequestException(`PayPal create order failed: ${JSON.stringify(errorData)}`);
            }

            return await response.json();
        } catch (err: any) {
            throw new BadRequestException(err.message || 'Error occurred while creating PayPal order');
        }
    }

    async captureOrder(paypalOrderID: string): Promise<any> {
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

            return await response.json();
        } catch (err: any) {
            throw new BadRequestException(err.message || 'Error occurred while capturing PayPal order');
        }
    }

    async refundCapture(paypalCaptureID: string, orderId: number): Promise<any> {
        const { apiBaseUrl } = this.getPaypalConfig();
        const accessToken = await this.getAccessToken();

        try {
            const response = await fetch(`${apiBaseUrl}/v2/payments/captures/${paypalCaptureID}/refund`, {
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

            return await response.json();
        } catch (err: any) {
            throw new BadRequestException(err.message || 'Error occurred while refunding PayPal order');
        }
    }
}
