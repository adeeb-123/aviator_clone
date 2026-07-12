import request from 'supertest';
import { authenticator } from 'otplib';
import { createApp } from '../app';
import { registerUser, login, auth } from './helpers';

const app = createApp();

describe('TOTP two-factor auth', () => {
  async function enroll() {
    const { creds, token } = await registerUser(app);
    const setup = await auth(request(app).post('/api/auth/2fa/setup'), token).send();
    const secret = setup.body.secret as string;
    const enable = await auth(request(app).post('/api/auth/2fa/enable'), token).send({ code: authenticator.generate(secret) });
    expect(enable.status).toBe(200);
    return { creds, secret };
  }

  it('requires a valid code at login once enabled', async () => {
    const { creds, secret } = await enroll();

    const noCode = await login(app, creds.email, creds.password);
    expect(noCode.status).toBe(401);
    expect(noCode.body.twoFactorRequired).toBe(true);

    const wrong = await login(app, creds.email, creds.password, { twoFactorCode: '000000' });
    expect(wrong.status).toBe(401);

    const good = await login(app, creds.email, creds.password, { twoFactorCode: authenticator.generate(secret) });
    expect(good.status).toBe(200);
    expect(good.body.accessToken).toBeTruthy();
  });

  it('rejects enabling 2FA with a bad code', async () => {
    const { token } = await registerUser(app);
    await auth(request(app).post('/api/auth/2fa/setup'), token).send();
    const res = await auth(request(app).post('/api/auth/2fa/enable'), token).send({ code: '000000' });
    expect(res.status).toBe(400);
  });
});
