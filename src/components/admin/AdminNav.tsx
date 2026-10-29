'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const PAGES = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/analytics', label: 'Analytics' },
] as const;

/** Switch between the admin pages, staying on the same course. */
export function AdminNav() {
  const course = useSearchParams().get('course');
  return <AdminNavLinks query={course ? `?course=${encodeURIComponent(course)}` : ''} />;
}

/** The links without the course (shown until the page's address is known). */
export function AdminNavLinks({ query = '' }: { query?: string }) {
  const path = usePathname();
  return (
    <nav className="seg" aria-label="Admin pages">
      {PAGES.map((p) => (
        <Link key={p.href} className="seg-btn" href={p.href + query} aria-current={path === p.href ? 'page' : undefined}>
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
