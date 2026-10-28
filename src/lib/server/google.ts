/**
 * Sign in with Google: checking the ID token the Google button hands the browser.
 *
 * The token is a JWT signed by Google. google-auth-library checks everything that makes it
 * trustworthy: the signature (against Google's public keys, fetched and cached), the audience
 * (it was issued for this app's client ID, not another site's), the issuer (accounts.google.com)
 * and the expiry. Only then are its name, email, picture and account id ("sub") used.
 *
 * The client ID comes from NEXT_PUBLIC_GOOGLE_CLIENT_ID: the button needs it in the browser too,
 * and it isn't a secret. There is no client secret: the button's popup flow doesn't use one.
 */
import { OAuth2Client } from 'google-auth-library';
import { cleanDisplayName, normalizeEmail } from '../account-rules';
import type { GoogleProfile } from './repo';

export const googleClientId = () => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? '';

const g = globalThis as typeof globalThis & { __kkGoogle?: OAuth2Client };

/** A Google profile photo, or null for anything that isn't a plain https URL. */
function photo(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 1000) return null;
  try {
    return new URL(v).protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
}

/** Throws when the token is forged, expired, or meant for another app. */
export async function verifyGoogleCredential(idToken: string, clientId = googleClientId()): Promise<GoogleProfile> {
  if (!clientId) throw new Error('Google sign-in isn’t set up: NEXT_PUBLIC_GOOGLE_CLIENT_ID is empty.');
  const client = (g.__kkGoogle ??= new OAuth2Client()); // keeps Google's keys cached between requests
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const p = ticket.getPayload();
  if (!p?.sub || !p.email || p.aud !== clientId) throw new Error('The Google token has no account id or email.');
  const email = normalizeEmail(p.email);
  return {
    sub: p.sub,
    email,
    emailVerified: p.email_verified === true,
    name: cleanDisplayName(p.name).slice(0, 40) || email.split('@')[0].slice(0, 40),
    picture: photo(p.picture),
  };
}
