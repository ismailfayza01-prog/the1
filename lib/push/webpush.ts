import 'server-only';

import { createECDH, createPrivateKey, createSign } from 'crypto';

type VapidKeypair = {
  publicKey: string;
  privateKey: string;
};

function base64UrlEncode(input: Buffer | string): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

function derToJoseSignature(derSignature: Buffer): Buffer {
  let offset = 0;
  if (derSignature[offset++] !== 0x30) {
    throw new Error('Invalid DER signature format (expected sequence)');
  }
  const seqLen = derSignature[offset++];
  if (seqLen & 0x80) {
    offset += seqLen & 0x7f;
  }
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature format (expected integer r)');
  }
  const rLen = derSignature[offset++];
  let r = derSignature.subarray(offset, offset + rLen);
  offset += rLen;
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature format (expected integer s)');
  }
  const sLen = derSignature[offset++];
  let s = derSignature.subarray(offset, offset + sLen);

  if (r.length > 32) r = r.subarray(r.length - 32);
  if (s.length > 32) s = s.subarray(s.length - 32);

  const out = Buffer.alloc(64);
  r.copy(out, 32 - r.length);
  s.copy(out, 64 - s.length);
  return out;
}

function loadVapidKeys(): VapidKeypair {
  const publicKey = (
    process.env.VAPID_PUBLIC_KEY ??
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    ''
  ).trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? '').trim();

  if (!publicKey || !privateKey) {
    throw new Error('Missing VAPID_PUBLIC_KEY/NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY');
  }

  return { publicKey, privateKey };
}

function buildVapidJwt(audience: string, subject: string, keys: VapidKeypair): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateBytes = base64UrlDecode(keys.privateKey);
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(privateBytes);
  const publicRaw = ecdh.getPublicKey(undefined, 'uncompressed');
  const x = publicRaw.subarray(1, 33);
  const y = publicRaw.subarray(33, 65);

  const keyObject = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: base64UrlEncode(x),
      y: base64UrlEncode(y),
      d: base64UrlEncode(privateBytes),
    },
    format: 'jwk',
  });

  const signer = createSign('SHA256');
  signer.update(signingInput);
  signer.end();

  const derSignature = signer.sign(keyObject);
  const joseSignature = derToJoseSignature(derSignature);
  return `${signingInput}.${base64UrlEncode(joseSignature)}`;
}

export async function sendWebPushNotification(
  endpoint: string,
  payload?: unknown
): Promise<{ ok: boolean; status: number; error?: string }> {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { ok: false, status: 0, error: 'Invalid push endpoint URL' };
  }

  const keys = loadVapidKeys();
  const audience = `${url.protocol}//${url.host}`;
  const subject = (process.env.VAPID_SUBJECT ?? 'mailto:support@the1000.ma').trim();
  const jwt = buildVapidJwt(audience, subject, keys);

  const headers: HeadersInit = {
    TTL: '60',
    Urgency: 'high',
    Authorization: `vapid t=${jwt}, k=${keys.publicKey}`,
    'Crypto-Key': `p256ecdsa=${keys.publicKey}`,
  };

  let body: string | undefined;
  if (payload !== undefined && payload !== null) {
    // Payload encryption is intentionally omitted for now; keep body undefined for broad compatibility.
    body = undefined;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { ok: false, status: response.status, error: text || response.statusText };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Push request failed',
    };
  }
}
