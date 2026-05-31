import { EmailTemplateService } from './email-template.service';

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  it('renders payment success email with order, invoice, transaction, and action links', () => {
    const email = service.renderPaymentSuccess({
      order: buildOrder() as never,
      paymentTransaction: {
        transactionID: 99,
        transactionContent: 'AIMS 123',
        method: 'VIETQR',
        createdAt: new Date('2026-05-31T08:00:00Z'),
      } as never,
      viewOrderUrl: 'http://localhost:4200/order-detail?orderId=123&token=abc',
      cancelOrderUrl: 'http://localhost:4200/order-detail?orderId=123&token=abc&intent=cancel',
    });

    expect(email.subject).toBe('AIMS Payment Confirmation - Order #123');
    expect(email.html).toContain('Nguyen Van A');
    expect(email.html).toContain('0901234567');
    expect(email.html).toContain('AIMS 123');
    expect(email.html).toContain('View order information');
    expect(email.html).toContain('Cancel order');
  });

  it('renders review result email with refund status for rejected orders', () => {
    const email = service.renderReviewResult(
      {
        order: buildOrder() as never,
        refundMethod: 'VIETQR',
        refundStatus: 'REFUND_PENDING',
        viewOrderUrl: 'http://localhost:4200/order-detail?orderId=123&token=abc',
      },
      false,
    );

    expect(email.subject).toBe('AIMS Order Rejected - Order #123');
    expect(email.html).toContain('REFUND_PENDING');
    expect(email.html).toContain('VIETQR');
  });
});

function buildOrder() {
  return {
    orderID: 123,
    subTotal: 100000,
    tax: 10000,
    shippingFee: 20000,
    totalPayment: 130000,
    customerAccessToken: 'abc',
    deliveryInfo: {
      receiverName: 'Nguyen Van A',
      phoneNumber: '0901234567',
      address: '1 Le Loi',
      province: 'Ha Noi',
      email: 'customer@example.com',
    },
    invoice: {
      invoiceID: 456,
      totalExcludeVAT: 100000,
      totalIncludeVAT: 110000,
      shippingFee: 20000,
      totalPayment: 130000,
    },
  };
}
