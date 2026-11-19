import Link from 'next/link';
import { Suspense } from 'react';
import { AdminNav, AdminNavLinks } from '@/components/admin/AdminNav';
import { BrandMark } from '@/components/auth/AuthShell';

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className="admin">
      <header className="appbar">
        <Link className="appbar-brand" href="/">
          <BrandMark size={26} />
          <span className="appbar-word">Karteikasten</span>
        </Link>
        <Suspense fallback={<AdminNavLinks />}>
          <AdminNav />
        </Suspense>
      </header>
      {children}
    </div>
  );
}
