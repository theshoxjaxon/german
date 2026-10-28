/**
 * Google ID tokens, checked by the real google-auth-library code. Only the download of Google's
 * public keys is replaced: the tokens here are signed with a key made up for the test, and
 * that key's public half stands in for Google's.
 */
import { createSign, generateKeyPairSync } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { verifyGoogleCredential } from './google';

const CLIENT_ID = '1234-test.apps.googleusercontent.com';
const KID = 'test-key';
const google = generateKeyPairSync('rsa', { modulusLength: 2048 });
const stranger = generateKeyPairSync('rsa', { modulusLength: 2048 });

const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(claims: Record<string, unknown>, key = google.privateKey, kid = KID) {
  const head = `${part({ alg: 'RS256', kid, typ: 'JWT' })}.${part(claims)}`;
  return `${head}.${createSign('RSA-SHA256').update(head).sign(key).toString('base64url')}`;
}

const now = Math.floor(Date.now() / 1000);
const claims = {
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: '110248495921238986420',
  email: 'Malika.K@Gmail.com',
  email_verified: true,
  name: '  Malika   Karimova ',
  picture: 'https://lh3.googleusercontent.com/a/photo',
  iat: now - 10,
  exp: now + 3600,
};

beforeAll(() => {
  const pem = google.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  vi.spyOn(OAuth2Client.prototype, 'getFederatedSignonCertsAsync').mockResolvedValue({ certs: { [KID]: pem }, format: 'PEM' } as never);
});

describe('Google ID tokens', () => {
  it('reads a valid token: account id, normalized email, name and photo', async () => {
    expect(await verifyGoogleCredential(sign(claims), CLIENT_ID)).toEqual({
      sub: '110248495921238986420',
      email: 'malika.k@gmail.com',
      emailVerified: true,
      name: 'Malika Karimova',
      picture: 'https://lh3.googleusercontent.com/a/photo',
    });
  });

  it('refuses a token made for another app (audience)', async () => {
    await expect(verifyGoogleCredential(sign({ ...claims, aud: 'other-app.apps.googleusercontent.com' }), CLIENT_ID)).rejects.toThrow(/audience/i);
  });

  it('refuses a token from another issuer', async () => {
    await expect(verifyGoogleCredential(sign({ ...claims, iss: 'https://evil.example' }), CLIENT_ID)).rejects.toThrow(/issuer/i);
  });

  it('refuses an expired token', async () => {
    await expect(verifyGoogleCredential(sign({ ...claims, iat: now - 7200, exp: now - 3600 }), CLIENT_ID)).rejects.toThrow(/too late/i);
  });

  it('refuses a token not signed by Google', async () => {
    await expect(verifyGoogleCredential(sign(claims, stranger.privateKey), CLIENT_ID)).rejects.toThrow(/signature/i);
    await expect(verifyGoogleCredential(sign(claims, google.privateKey, 'unknown-key'), CLIENT_ID)).rejects.toThrow();
    const [head, , sig] = sign(claims).split('.');
    await expect(verifyGoogleCredential(`${head}.${part({ ...claims, email: 'teacher@markaz.uz' })}.${sig}`, CLIENT_ID)).rejects.toThrow(/signature/i);
  });

  it('passes on whether Google verified the email, and drops odd photos', async () => {
    const p = await verifyGoogleCredential(sign({ ...claims, email_verified: false, picture: 'javascript:alert(1)', name: '' }), CLIENT_ID);
    expect(p).toMatchObject({ emailVerified: false, picture: null, name: 'malika.k' });
  });

  it('needs the client id to be set', async () => {
    await expect(verifyGoogleCredential(sign(claims), '')).rejects.toThrow(/NEXT_PUBLIC_GOOGLE_CLIENT_ID/);
  });
});
