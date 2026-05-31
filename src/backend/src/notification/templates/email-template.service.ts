import { Injectable } from '@nestjs/common';
import { Order } from '../../order/entities/order.entity';
import { PaymentTransaction } from '../../payment/entities/payment-transaction.entity';

export interface OrderEmailContext {
  order: Order;
  paymentTransaction?: PaymentTransaction | null;
  viewOrderUrl?: string;
  cancelOrderUrl?: string;
  refundMethod?: string | null;
  refundStatus?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailTemplateService {
  renderPaymentSuccess(context: OrderEmailContext): RenderedEmail {
    const { order, paymentTransaction, viewOrderUrl, cancelOrderUrl } = context;
    const subject = `AIMS Payment Confirmation - Order #${order.orderID}`;
    const html = this.layout(
      'Payment confirmed',
      `
        ${this.orderSummary(order)}
        ${this.invoiceSummary(order)}
        ${this.paymentSummary(paymentTransaction)}
        ${this.actionButtons([
          ['View order information', viewOrderUrl],
          ['Cancel order', cancelOrderUrl],
        ])}
      `,
    );

    return {
      subject,
      html,
      text: `Payment confirmed for AIMS order #${order.orderID}. Total: ${this.money(order.totalPayment)}.`,
    };
  }

  renderCancellation(context: OrderEmailContext): RenderedEmail {
    const { order, refundMethod, refundStatus, viewOrderUrl } = context;
    const subject = `AIMS Order Cancellation Confirmation - Order #${order.orderID}`;
    const html = this.layout(
      'Order cancellation confirmed',
      `
        ${this.orderSummary(order)}
        ${this.infoTable([
          ['Refund amount', this.money(order.totalPayment)],
          ['Refund method', refundMethod || 'Not applicable'],
          ['Refund status', refundStatus || 'No payment refund required'],
        ])}
        ${this.actionButtons([['View order information', viewOrderUrl]])}
      `,
    );

    return {
      subject,
      html,
      text: `Order #${order.orderID} was cancelled. Refund status: ${refundStatus || 'No payment refund required'}.`,
    };
  }

  renderReviewResult(context: OrderEmailContext, approved: boolean): RenderedEmail {
    const { order, refundMethod, refundStatus, viewOrderUrl } = context;
    const subject = approved
      ? `AIMS Order Approved - Order #${order.orderID}`
      : `AIMS Order Rejected - Order #${order.orderID}`;
    const title = approved ? 'Your order was approved' : 'Your order was rejected';
    const nextStep = approved
      ? 'Your order has been accepted and will be prepared for delivery.'
      : 'Your order could not be accepted. Refund information is shown below if payment was already completed.';
    const refundBlock = approved
      ? ''
      : this.infoTable([
          ['Refund amount', this.money(order.totalPayment)],
          ['Refund method', refundMethod || 'Not applicable'],
          ['Refund status', refundStatus || 'No payment refund required'],
        ]);
    const html = this.layout(
      title,
      `
        <p style="margin:0 0 20px;color:#334155;line-height:1.6">${this.escape(nextStep)}</p>
        ${this.orderSummary(order)}
        ${refundBlock}
        ${this.actionButtons([['View order information', viewOrderUrl]])}
      `,
    );

    return {
      subject,
      html,
      text: `${title} for AIMS order #${order.orderID}. ${nextStep}`,
    };
  }

  private orderSummary(order: Order): string {
    const deliveryInfo = order.deliveryInfo;
    return this.section(
      'Order information',
      this.infoTable([
        ['Order ID', `#${order.orderID}`],
        ['Customer name', deliveryInfo?.receiverName || 'N/A'],
        ['Phone number', deliveryInfo?.phoneNumber || 'N/A'],
        ['Shipping address', deliveryInfo?.address || 'N/A'],
        ['Province', deliveryInfo?.province || 'N/A'],
        ['Total amount', this.money(order.totalPayment)],
      ]),
    );
  }

  private invoiceSummary(order: Order): string {
    return this.section(
      'Invoice details',
      this.infoTable([
        ['Invoice ID', order.invoice ? `#${order.invoice.invoiceID}` : 'N/A'],
        ['Subtotal excluding VAT', this.money(order.invoice?.totalExcludeVAT ?? order.subTotal)],
        ['Total including VAT', this.money(order.invoice?.totalIncludeVAT ?? Number(order.subTotal) + Number(order.tax))],
        ['Shipping fee', this.money(order.invoice?.shippingFee ?? order.shippingFee)],
        ['Total payment', this.money(order.invoice?.totalPayment ?? order.totalPayment)],
      ]),
    );
  }

  private paymentSummary(paymentTransaction?: PaymentTransaction | null): string {
    return this.section(
      'Payment transaction',
      this.infoTable([
        ['Transaction ID', paymentTransaction ? `#${paymentTransaction.transactionID}` : 'N/A'],
        ['Transaction content', paymentTransaction?.transactionContent || paymentTransaction?.method || 'N/A'],
        [
          'Transaction datetime',
          paymentTransaction?.createdAt ? new Date(paymentTransaction.createdAt).toLocaleString('vi-VN') : 'N/A',
        ],
      ]),
    );
  }

  private layout(title: string, body: string): string {
    return `
      <div style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
        <div style="max-width:720px;margin:0 auto;padding:32px 16px">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
            <div style="padding:28px 32px;background:#0f172a;color:#ffffff">
              <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd;font-weight:700">AIMS Store</div>
              <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25">${this.escape(title)}</h1>
            </div>
            <div style="padding:28px 32px">${body}</div>
            <div style="padding:18px 32px;background:#f1f5f9;color:#64748b;font-size:12px;line-height:1.5">
              This is an automated notification from AIMS. If you did not place this order, please contact support.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private section(title: string, content: string): string {
    return `
      <section style="margin:0 0 24px">
        <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a">${this.escape(title)}</h2>
        ${content}
      </section>
    `;
  }

  private infoTable(rows: [string, string][]): string {
    return `
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <td style="padding:11px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:38%">${this.escape(label)}</td>
                  <td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600">${this.escape(value)}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  private actionButtons(actions: [string, string | undefined][]): string {
    const links = actions.filter(([, url]) => Boolean(url));
    if (links.length === 0) {
      return '';
    }

    return `
      <div style="margin-top:28px">
        ${links
          .map(
            ([label, url]) => `
              <a href="${this.escape(url || '')}" style="display:inline-block;margin:0 10px 10px 0;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700">${this.escape(label)}</a>
            `,
          )
          .join('')}
      </div>
    `;
  }

  private money(value: number | string | null | undefined): string {
    const amount = Number(value ?? 0);
    return `${new Intl.NumberFormat('vi-VN').format(Number.isFinite(amount) ? amount : 0)} VND`;
  }

  private escape(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
