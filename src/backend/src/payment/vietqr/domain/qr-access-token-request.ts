export class QRAccessTokenRequest {
  constructor(
    private readonly userName: string,
    private readonly password: string,
  ) {}

  buildAuthorizationHeader(): string {
    const credentials = Buffer.from(`${this.userName}:${this.password}`).toString(
      'base64',
    );

    return `Basic ${credentials}`;
  }
}
