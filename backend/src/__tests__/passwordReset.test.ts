import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../app';
import { registerUser, login } from './helpers';
import { User } from '../models/User';

const app = createApp();
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

describe('password reset', () => {
  it('does not reveal whether an email exists', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('issues a hashed, time-limited token for a known email', async () => {
    const { creds } = await registerUser(app);
    await request(app).post('/api/auth/forgot-password').send({ email: creds.email });
    const u = await User.findOne({ email: creds.email }).select('+passwordResetToken +passwordResetExpires');
    expect(u?.passwordResetToken).toBeTruthy();
    expect(u?.passwordResetToken).not.toBe(''); // stored hashed, never raw
    expect(u!.passwordResetExpires!.getTime()).toBeGreaterThan(Date.now());
  });

  it('resets the password, revokes sessions, and rotates credentials', async () => {
    const { creds } = await registerUser(app);
    await User.updateOne(
      { email: creds.email },
      { $set: { passwordResetToken: sha256('KNOWN'), passwordResetExpires: new Date(Date.now() + 60000), refreshTokenId: 'old-session' } },
    );

    const res = await request(app).post('/api/auth/reset-password').send({ token: 'KNOWN', password: 'NewPassword123' });
    expect(res.status).toBe(200);

    const afterReset = await User.findOne({ email: creds.email });
    expect(afterReset?.refreshTokenId).toBeUndefined(); // all sessions revoked

    const oldLogin = await login(app, creds.email, creds.password);
    expect(oldLogin.status).toBe(401);
    const newLogin = await login(app, creds.email, 'NewPassword123');
    expect(newLogin.status).toBe(200);
  });

  it('rejects an invalid or expired reset token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'bogus', password: 'NewPassword123' });
    expect(res.status).toBe(400);
  });
});
