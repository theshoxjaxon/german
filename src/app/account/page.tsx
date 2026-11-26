import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AccountView } from '@/components/auth/AccountView';
import { AuthShell } from '@/components/auth/AuthShell';
import { api } from '@/lib/api';
import type { Me } from '@/lib/types';

export const metadata: Metadata = { title: 'Your account · Karteikasten', robots: { index: false } };

export default function AccountPage() {
  return (
    // The session is read at request time, so it sits behind a Suspense boundary (required with Cache Components).
    <Suspense fallback={<main className="auth" aria-busy="true" />}>
      <Account />
    </Suspense>
  );
}

/** The real check for /account (the proxy only looks for a cookie): signed out → /login, and back here after. */
async function Account() {
  await connection();
  let me: Me | null;
  try {
    const r = await api<{ me: Me }>('/me');
    if (r.status !== 401 && !r.ok) throw new Error(`the API answered ${r.status}`);
    me = r.ok ? r.data.me : null;
  } catch (e) {
    console.error(`Karteikasten: the API is unavailable (${(e as Error).message}).`);
    return <AuthShell title="Your account" lede="The app can’t reach its database right now. Please try again in a few minutes." guest={false} />;
  }
  if (!me) redirect('/login?next=/account'); // outside the try: redirect() works by throwing
  return <AccountView me={me} />;
}
