import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignupForm } from '@/components/auth/AuthForms';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { SignedInRedirect } from '@/components/auth/SignedInRedirect';

export const metadata: Metadata = { title: 'Create a profile · Karteikasten' };

export default function SignupPage({ searchParams }: PageProps<'/signup'>) {
  return (
    <>
      <Suspense fallback={null}>
        <SignedInRedirect searchParams={searchParams} />
      </Suspense>
      <AuthShell title="Create your profile" lede="Free, and it takes a minute. Then study with everyone on the class leaderboard.">
        <GoogleButton />
        <SignupForm />
      </AuthShell>
    </>
  );
}
