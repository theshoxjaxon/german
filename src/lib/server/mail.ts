/**
 * The one email the app sends: a link to choose a password, through Resend's HTTP API (no SDK
 * needed). RESEND_API_KEY and EMAIL_FROM come from the environment. Without a key, during
 * development the link is printed in the server console instead, so the whole flow can be tried
 * locally; in production nothing is sent and the log says why (never the link itself).
 */
import { headers } from 'next/headers';
import type { UiLang } from '../types';

export const RESET_MINUTES = 45;

/**
 * The site's address for links in emails: APP_URL, else Vercel's production domain, else
 * (in development) the address this request came to. Links never trust the Host header in production.
 */
export async function appUrl(): Promise<string> {
  const set = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (set) return set;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  const host = (await headers()).get('host') ?? 'localhost:3000';
  if (process.env.NODE_ENV === 'production') console.warn('Karteikasten: set APP_URL so emailed links point to the right site.');
  return `${/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https'}://${host}`;
}

type Purpose = 'reset' | 'set';
const COPY: Record<UiLang, { subject: Record<Purpose, string>; hi: string; intro: Record<Purpose, string>; button: Record<Purpose, string>; expires: string; ignore: string }> = {
  en: {
    subject: { reset: 'Reset your Karteikasten password', set: 'Set a password for Karteikasten' },
    hi: 'Hi {name},',
    intro: {
      reset: 'Someone (hopefully you) asked to reset the password of your Karteikasten profile.',
      set: 'You can set a password for your Karteikasten profile, so you can also log in with your email address.',
    },
    button: { reset: 'Choose a new password', set: 'Set a password' },
    expires: 'The link works once, for {m} minutes.',
    ignore: 'If you didn’t ask for this, ignore this email: your password stays as it is.',
  },
  uz: {
    subject: { reset: 'Karteikasten parolingizni tiklang', set: 'Karteikasten uchun parol oʻrnating' },
    hi: 'Salom, {name}!',
    intro: {
      reset: 'Kimdir (umid qilamizki, siz) Karteikasten profilingiz parolini tiklashni soʻradi.',
      set: 'Karteikasten profilingiz uchun parol oʻrnatishingiz mumkin. Shunda elektron pochtangiz bilan ham kira olasiz.',
    },
    button: { reset: 'Yangi parol tanlash', set: 'Parol oʻrnatish' },
    expires: 'Havola faqat bir marta va {m} daqiqa davomida ishlaydi.',
    ignore: 'Agar buni siz soʻramagan boʻlsangiz, bu xatni eʼtiborsiz qoldiring: parolingiz oʻzgarmaydi.',
  },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function passwordEmail(name: string, link: string, lang: UiLang, purpose: Purpose) {
  const c = COPY[lang];
  const hi = c.hi.replace('{name}', name);
  const expires = c.expires.replace('{m}', String(RESET_MINUTES));
  const text = [hi, '', c.intro[purpose], '', `${c.button[purpose]}: ${link}`, '', expires, c.ignore, '', 'Karteikasten'].join('\n');
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;padding:24px;background:#e8ecf1;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#131a23">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:24px">
<p style="margin:0 0 16px;font-weight:700;font-size:18px">Karteikasten</p>
<p style="margin:0 0 12px">${esc(hi)}</p>
<p style="margin:0 0 20px">${esc(c.intro[purpose])}</p>
<p style="margin:0 0 20px"><a href="${esc(link)}" style="display:inline-block;background:#131a23;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${esc(c.button[purpose])}</a></p>
<p style="margin:0 0 8px;font-size:14px;color:#465163">${esc(expires)}</p>
<p style="margin:0 0 16px;font-size:14px;color:#465163">${esc(c.ignore)}</p>
<p style="margin:0;font-size:12px;color:#657184;word-break:break-all">${esc(link)}</p>
</div></body></html>`;
  return { subject: c.subject[purpose], text, html };
}

export async function sendPasswordEmail(input: { to: string; name: string; link: string; lang: UiLang; purpose: Purpose }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n  Karteikasten (development, no RESEND_API_KEY): password link for ${input.to}\n  ${input.link}\n`);
    } else {
      console.error('Karteikasten: RESEND_API_KEY is not set, so a password email could not be sent.');
    }
    return false;
  }
  const { subject, text, html } = passwordEmail(input.name, input.link, input.lang, input.purpose);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM?.trim() || 'Karteikasten <onboarding@resend.dev>', to: [input.to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return true;
    console.error(`Karteikasten: Resend refused a password email (${res.status}).`, (await res.text()).slice(0, 300));
  } catch (e) {
    console.error('Karteikasten: could not reach Resend to send a password email.', (e as Error).message);
  }
  return false;
}
