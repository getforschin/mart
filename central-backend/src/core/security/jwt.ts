import { JwtPayload } from './authentication';

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64url');
}

export function createAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresInSeconds = 86400): string {
  const header = toBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = toBase64Url(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + expiresInSeconds,
    }),
  );
  return `${header}.${body}.dev`;
}
