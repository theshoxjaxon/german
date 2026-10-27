'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PAGES = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/analytics', label: 'Analytics' },
] as const;

/** Switch between the admin pages. */
export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="seg" aria-label="Admin pages">
      {PAGES.map((p) => (
        <Link key={p.href} className="seg-btn" href={p.href} aria-current={path === p.href ? 'page' : undefined}>
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
