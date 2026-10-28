import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ForgotForm } from '@/components/auth/AuthForms';
import { AuthShell } from '@/components/auth/AuthShell';
import { SignedInRedirect } from '@/components/auth/SignedInRedirect';

export const metadata: Metadata = { title: 'Forgot password · Karteikasten' };

export default function ForgotPasswordPage({ searchParams }: PageProps<'/forgot-password'>) {
  return (
    <>
      <Suspense fallback={null}>
        <SignedInRedirect searchParams={searchParams} />
      </Suspense>
      <AuthShell title="Forgot your password?" lede="Enter the email you signed up with. We’ll send you a link to choose a new password.">
        <ForgotForm />
      </AuthShell>
    </>
  );
}
