import type { Metadata } from 'next';
import { ResetForm } from '@/components/auth/AuthForms';
import { AuthShell } from '@/components/auth/AuthShell';

// The link's token is in the address: never send it on to another site in a Referer header.
export const metadata: Metadata = { title: 'New password · Karteikasten', referrer: 'no-referrer', robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" lede="After this, every device is signed out and you log in with the new password.">
      <ResetForm />
    </AuthShell>
  );
}
