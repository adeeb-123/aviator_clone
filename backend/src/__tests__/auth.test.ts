import request from 'supertest';
import { createApp } from '../app';

// Note: Redis-backed rate limiting uses in-memory store by default here.
const app = createApp();

describe('auth API', () => {
  const creds = { username: 'tester', email: 'tester@example.com', password: 'Password123' };

  it('registers a new user and returns an access token + welcome bonus', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.balance).toBe(100);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate registration', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('rejects bad credentials', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('validates registration input', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'x', email: 'bad', password: '1' });
    expect(res.status).toBe(400);
  });
});
