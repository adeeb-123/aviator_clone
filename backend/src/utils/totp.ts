import { authenticator } from 'otplib';

// Allow ±1 time-step (30s) of clock skew between server and authenticator app.
authenticator.options = { window: 1 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** otpauth:// URI the frontend renders as a QR code for Google Authenticator etc. */
export function totpKeyUri(account: string, secret: string): string {
  return authenticator.keyuri(account, 'Aviator', secret);
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: String(token).trim(), secret });
  } catch {
    return false;
  }
}
