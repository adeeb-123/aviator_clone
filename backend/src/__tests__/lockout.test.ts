import request from 'supertest';
import { createApp } from '../app';
import { registerUser, login } from './helpers';

const app = createApp();

describe('login lockout (brute-force defense)', () => {
  it('locks the account after repeated failures, even for the correct password', async () => {
    const { creds } = await registerUser(app);
    for (let i = 0; i < 5; i += 1) {
      const r = await login(app, creds.email, 'wrong-password');
      expect(r.status).toBe(401);
    }
    const locked = await login(app, creds.email, creds.password);
    expect(locked.status).toBe(403);
    expect(locked.body.error).toMatch(/locked/i);
  });
});
