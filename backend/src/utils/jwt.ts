import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { env } from '../config/env';

// Binding issuer + audience means a token minted for this API can't be replayed
// against another service that happens to share (or leak) a secret, and forces
// HS256 explicitly so an attacker can't downgrade the algorithm.
const ISSUER = 'aviator-api';
const ACCESS_AUD = 'aviator-access';
const REFRESH_AUD = 'aviator-refresh';
const ALG: jwt.Algorithm = 'HS256';

export interface AccessPayload {
  sub: string; // user id
  role: 'user' | 'admin';
  username: string;
  mfa?: boolean; // true if this session satisfied two-factor auth
}

export interface RefreshPayload {
  sub: string;
  tokenId: string; // rotation id, stored on the user
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtAccessTtl,
    algorithm: ALG,
    issuer: ISSUER,
    audience: ACCESS_AUD,
  } as SignOptions);
}

export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshTtl,
    algorithm: ALG,
    issuer: ISSUER,
    audience: REFRESH_AUD,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.jwtSecret, {
    algorithms: [ALG],
    issuer: ISSUER,
    audience: ACCESS_AUD,
  } as VerifyOptions) as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.jwtRefreshSecret, {
    algorithms: [ALG],
    issuer: ISSUER,
    audience: REFRESH_AUD,
  } as VerifyOptions) as RefreshPayload;
}
