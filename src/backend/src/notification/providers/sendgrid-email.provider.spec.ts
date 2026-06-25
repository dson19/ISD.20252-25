import sendgrid from '@sendgrid/mail';
import { SendGridEmailProvider } from './sendgrid-email.provider';

jest.mock('@sendgrid/mail', () => ({
  __esModule: true,
  default: {
    setApiKey: jest.fn(),
    send: jest.fn(),
  },
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

describe('SendGridEmailProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      SENDGRID_API_KEY: 'test-key',
      SENDGRID_FROM_EMAIL: 'no-reply@aims.vn',
      SENDGRID_FROM_NAME: 'AIMS Store',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('renders via template service and sends through SendGrid', async () => {
    const emailTemplateService = {
      renderPaymentSuccess: jest.fn().mockReturnValue({
        subject: 'Subject',
        html: '<p>Hello</p>',
        text: 'Hello',
      }),
      renderCancellation: jest.fn(),
      renderReviewResult: jest.fn(),
    };
    const provider = new SendGridEmailProvider(emailTemplateService as never);
    (sendgrid.send as jest.Mock).mockResolvedValue(undefined);

    await provider.send({
      order: { orderID: 1, deliveryInfo: { email: 'customer@example.com' } } as never,
      event: { type: 'ORDER_PAYMENT_SUCCEEDED', orderId: 1 },
      paymentTransaction: null,
      urls: { viewOrder: 'http://app/view', cancelOrder: 'http://app/cancel' },
    });

    expect(emailTemplateService.renderPaymentSuccess).toHaveBeenCalledTimes(1);
    expect(sendgrid.setApiKey).toHaveBeenCalledWith('test-key');
    expect(sendgrid.send).toHaveBeenCalledWith({
      to: 'customer@example.com',
      from: {
        email: 'no-reply@aims.vn',
        name: 'AIMS Store',
      },
      subject: 'Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
    });
  });

  it('skips when the order has no customer email', async () => {
    const emailTemplateService = {
      renderPaymentSuccess: jest.fn(),
      renderCancellation: jest.fn(),
      renderReviewResult: jest.fn(),
    };
    const provider = new SendGridEmailProvider(emailTemplateService as never);

    await provider.send({
      order: { orderID: 2, deliveryInfo: { email: undefined } } as never,
      event: { type: 'ORDER_PAYMENT_SUCCEEDED', orderId: 2 },
      paymentTransaction: null,
      urls: { viewOrder: 'http://app/view', cancelOrder: 'http://app/cancel' },
    });

    expect(sendgrid.send).not.toHaveBeenCalled();
  });
});
