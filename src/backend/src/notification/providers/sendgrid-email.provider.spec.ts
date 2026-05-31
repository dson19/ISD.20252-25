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

  it('sends email through SendGrid with expected message fields', async () => {
    const provider = new SendGridEmailProvider();
    (sendgrid.send as jest.Mock).mockResolvedValue(undefined);

    await provider.send({
      to: 'customer@example.com',
      subject: 'Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

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
});
