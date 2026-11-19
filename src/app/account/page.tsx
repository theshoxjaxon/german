import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AccountView } from '@/components/auth/AccountView';
import { AuthShell } from '@/components/auth/AuthShell';
import { describeDbError } from '@/lib/server/db-health';
import * as repo from '@/lib/server/repo';
import { currentUser } from '@/lib/server/session';

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
  let user: repo.UserRow | null;
  try {
    user = await currentUser();
  } catch (e) {
    const { problem, message } = describeDbError(e);
    console.error(`Karteikasten: database unavailable (${problem}). ${message}`);
    return <AuthShell title="Your account" lede="The app can’t reach its database right now. Please try again in a few minutes." guest={false} />;
  }
  if (!user) redirect('/login?next=/account'); // outside the try: redirect() works by throwing
  return <AccountView me={repo.publicUser(user)} />;
}
