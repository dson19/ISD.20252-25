export class QRAccessTokenResponse {
  constructor(
    public accessToken: string = '',
    public tokenType: string = '',
    public expiresIn: number = 0,
  ) {}

  parseResponseString(response: string): void {
    const parsed = JSON.parse(response) as {
      accessToken?: string;
      access_token?: string;
      tokenType?: string;
      token_type?: string;
      expiresIn?: number;
      expires_in?: number;
    };

    this.accessToken = parsed.accessToken || parsed.access_token || '';
    this.tokenType = parsed.tokenType || parsed.token_type || '';
    this.expiresIn = parsed.expiresIn || parsed.expires_in || 0;
  }
}
