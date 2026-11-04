import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Gentium_Book_Plus, Literata } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

// Display face for German words on the cards
const literata = Literata({ subsets: ['latin', 'latin-ext'], axes: ['opsz'], variable: '--font-literata', display: 'swap' });
// UI face designed for legibility (clear I / l / 1)
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ['latin', 'latin-ext'], variable: '--font-atkinson', display: 'swap' });
// Numbers in tables and intervals
const atkinsonMono = Atkinson_Hyperlegible_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-atkinson-mono', display: 'swap' });
// IPA pronunciation symbols
const gentium = Gentium_Book_Plus({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-gentium', display: 'swap' });

/** The site's public address, for absolute links in previews: APP_URL, else Vercel's production domain. */
const siteUrl = process.env.APP_URL?.trim().replace(/\/+$/, '')
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}` : undefined);
const description = 'Nemis va ingliz tili soʻzlari uchun kartochkalar, darsdagidek sinov testlari va sinfdoshlar bilan birga oʻrganish. Oʻzbekcha tarjimalar bilan, bepul.';

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: 'Karteikasten',
  description,
  appleWebApp: { capable: true, title: 'Karteikasten', statusBarStyle: 'default' },
  // The link preview in Telegram, WhatsApp and the like (the image is app/opengraph-image.tsx)
  openGraph: { title: 'Karteikasten', description, siteName: 'Karteikasten', locale: 'uz_UZ', type: 'website' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e8ecf1' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1319' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${literata.variable} ${atkinson.variable} ${atkinsonMono.variable} ${gentium.variable}`}>
      <body>
        {children}
        {/*
          Vercel Web Analytics: page views and visitors in the Vercel dashboard (no cookies). This is
          the script the @vercel/analytics package loads, added directly to skip that package's
          framework peer dependencies. It only exists on Vercel, so it's left out elsewhere.
        */}
        {process.env.VERCEL && <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />}
      </body>
    </html>
  );
}
