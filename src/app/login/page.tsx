import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/AuthForms';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { SignedInRedirect } from '@/components/auth/SignedInRedirect';

export const metadata: Metadata = { title: 'Log in · Karteikasten' };

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <>
      <Suspense fallback={null}>
        <SignedInRedirect searchParams={searchParams} />
      </Suspense>
      <AuthShell title="Log in" lede="Welcome back. Your cards are waiting.">
        <GoogleButton />
        <LoginForm />
      </AuthShell>
    </>
  );
}
