import type { ReactNode } from 'react';

/** The frame around the login and sign-up forms: an index card on the desk. */
export function AuthShell({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <BrandMark />
          <span>Karteikasten</span>
        </div>
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        {children}
      </div>
    </main>
  );
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="brand-mark">
      <rect width="64" height="64" rx="14" fill="#131a23" />
      <rect x="18" y="11" width="34" height="26" rx="4" fill="#ffd447" transform="rotate(8 35 24)" />
      <rect x="11" y="22" width="40" height="30" rx="4" fill="#ffffff" />
      <path d="M11 31h40" stroke="#cd3c46" strokeWidth="2" />
      <path d="M17 39h24M17 45h15" stroke="#1f56b3" strokeWidth="2.6" strokeLinecap="round" opacity=".4" />
    </svg>
  );
}
