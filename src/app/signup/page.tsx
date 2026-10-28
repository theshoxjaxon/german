import type { Metadata } from 'next';
import { SignupForm } from '@/components/auth/AuthForms';
import { AuthShell } from '@/components/auth/AuthShell';

export const metadata: Metadata = { title: 'Create a profile · Karteikasten' };

export default function SignupPage() {
  return (
    <AuthShell title="Create your profile" lede="Free, and it takes a minute. Then study with everyone on the class leaderboard.">
      <SignupForm />
    </AuthShell>
  );
}
