import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/AuthForms';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleButton } from '@/components/auth/GoogleButton';

export const metadata: Metadata = { title: 'Log in · Karteikasten' };

export default function LoginPage() {
  return (
    <AuthShell title="Log in" lede="Welcome back. Your cards are waiting.">
      <GoogleButton />
      <LoginForm />
    </AuthShell>
  );
}
