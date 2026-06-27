import {SignJWT, jwtVerify} from 'jose';

function getKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET?.trim() || 'fallback-secret-for-build-time-only';
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: Record<string, unknown>) {
  return await new SignJWT(payload)
    .setProtectedHeader({alg: 'HS256'})
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getKey());
}

export async function decrypt(input: string): Promise<Record<string, unknown> | null> {
  try {
    const {payload} = await jwtVerify(input, getKey(), {algorithms: ['HS256']});
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}
