import request from 'supertest';
import { createApp } from '../app';
import { registerUser, auth } from './helpers';

const app = createApp();
const withdraw = (token: string, amount: number) =>
  auth(request(app).post('/api/payments/withdraw'), token).send({ amount });

describe('withdrawal limits & atomicity', () => {
  it('rejects a below-minimum withdrawal', async () => {
    const { token } = await registerUser(app);
    expect((await withdraw(token, 10)).status).toBe(400);
  });

  it('rejects an above-maximum withdrawal', async () => {
    const { token } = await registerUser(app);
    expect((await withdraw(token, 300000)).status).toBe(400);
  });

  it('rejects a withdrawal exceeding the balance', async () => {
    const { token } = await registerUser(app); // welcome balance = 100
    expect((await withdraw(token, 100000)).status).toBe(400);
  });

  it('allows a valid withdrawal within balance and limits', async () => {
    const { token } = await registerUser(app); // balance 100, min 50
    const res = await withdraw(token, 50);
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(50);
  });
});
