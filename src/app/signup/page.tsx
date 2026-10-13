import type { Metadata } from 'next';
import { SignupForm } from '@/components/auth/AuthForms';
import { AuthShell } from '@/components/auth/AuthShell';

export const metadata: Metadata = { title: 'Create a profile · Karteikasten' };

export default function SignupPage() {
  return (
    <AuthShell title="Create your profile" lede="Study German with your class. You need the join code from your teacher.">
      <SignupForm />
    </AuthShell>
  );
}
