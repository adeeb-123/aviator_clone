import request from 'supertest';
import { createApp } from '../app';
import { registerUser, makeAdmin, makeAdminWith2FA, auth } from './helpers';

const app = createApp();

describe('authorization & admin MFA enforcement', () => {
  it('rejects unauthenticated access to admin routes', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('rejects a normal user from admin routes', async () => {
    const { token } = await registerUser(app);
    const res = await auth(request(app).get('/api/admin/dashboard'), token);
    expect(res.status).toBe(403);
  });

  it('blocks an admin who has not enrolled 2FA', async () => {
    const { token } = await makeAdmin(app);
    const res = await auth(request(app).get('/api/admin/dashboard'), token);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/two-factor/i);
  });

  it('allows an admin with a 2FA-satisfied session', async () => {
    const { token } = await makeAdminWith2FA(app);
    // /admin/users is engine-independent, so a 200 proves the auth layer let us
    // through (a non-2FA admin would get 403 at requireAdmin, before the handler).
    const res = await auth(request(app).get('/api/admin/users'), token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});
