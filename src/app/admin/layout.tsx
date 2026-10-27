import Link from 'next/link';
import { AdminNav } from '@/components/admin/AdminNav';
import { BrandMark } from '@/components/auth/AuthShell';

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className="admin">
      <header className="appbar">
        <Link className="appbar-brand" href="/">
          <BrandMark size={26} />
          <span className="appbar-word">Karteikasten</span>
        </Link>
        <AdminNav />
      </header>
      {children}
    </div>
  );
}
