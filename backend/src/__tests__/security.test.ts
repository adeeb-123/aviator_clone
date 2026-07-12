import request from 'supertest';
import { createApp } from '../app';
import { registerUser } from './helpers';

const app = createApp();

describe('security hardening', () => {
  it('sends hardened security headers and hides the stack', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('does not leak password hash or secrets in the user payload', async () => {
    const { user } = await registerUser(app);
    expect(user.passwordHash).toBeUndefined();
    expect(user.refreshTokenId).toBeUndefined();
    expect(user.twoFactorSecret).toBeUndefined();
    expect(user.emailVerifyToken).toBeUndefined();
  });

  it('blocks NoSQL operator injection in the login body', async () => {
    // Classic auth-bypass attempt: email:{ $gt: "" } would match any user.
    const { creds } = await registerUser(app);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: creds.password });
    expect(res.status).not.toBe(200);
    expect(res.body.accessToken).toBeUndefined();
  });
});
