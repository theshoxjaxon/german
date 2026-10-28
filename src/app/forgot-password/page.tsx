import type { Metadata } from 'next';
import { ForgotForm } from '@/components/auth/AuthForms';
import { AuthShell } from '@/components/auth/AuthShell';

export const metadata: Metadata = { title: 'Forgot password · Karteikasten' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot your password?" lede="Enter the email you signed up with. We’ll send you a link to choose a new password.">
      <ForgotForm />
    </AuthShell>
  );
}
