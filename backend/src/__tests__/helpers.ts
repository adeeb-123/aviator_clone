import request from 'supertest';
import { Application } from 'express';
import { authenticator } from 'otplib';
import { User } from '../models/User';

export const STRONG_PASS = 'Password123';

let seq = 0;
function uniq(): string {
  seq += 1;
  return `${seq}${(seq * 7).toString(36)}`;
}

export async function registerUser(app: Application, over: Record<string, unknown> = {}) {
  const id = uniq();
  const creds = { username: `user${id}`, email: `user${id}@example.com`, password: STRONG_PASS, ...over };
  const res = await request(app).post('/api/auth/register').send(creds);
  return { creds, res, token: res.body.accessToken as string, user: res.body.user };
}

export function login(app: Application, email: string, password: string, extra: Record<string, unknown> = {}) {
  return request(app).post('/api/auth/login').send({ email, password, ...extra });
}

export function auth(req: request.Test, token: string) {
  return req.set('Authorization', `Bearer ${token}`);
}

/** Create an admin who has NOT enrolled 2FA (session mfa=false). */
export async function makeAdmin(app: Application) {
  const { creds } = await registerUser(app);
  await User.updateOne({ email: creds.email }, { $set: { role: 'admin' } });
  const res = await login(app, creds.email, creds.password);
  return { creds, token: res.body.accessToken as string };
}

/** Create an admin who HAS enrolled 2FA and holds an mfa=true session token. */
export async function makeAdminWith2FA(app: Application) {
  const { creds } = await registerUser(app);
  await User.updateOne({ email: creds.email }, { $set: { role: 'admin' } });

  let res = await login(app, creds.email, creds.password);
  const bootstrapToken = res.body.accessToken as string;

  const setup = await auth(request(app).post('/api/auth/2fa/setup'), bootstrapToken).send();
  const secret = setup.body.secret as string;
  await auth(request(app).post('/api/auth/2fa/enable'), bootstrapToken).send({ code: authenticator.generate(secret) });

  res = await login(app, creds.email, creds.password, { twoFactorCode: authenticator.generate(secret) });
  return { creds, secret, token: res.body.accessToken as string };
}
