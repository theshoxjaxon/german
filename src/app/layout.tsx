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

export const metadata: Metadata = {
  title: 'Karteikasten',
  description: 'Spaced-repetition flashcards (SM-2) and a word database for German and English vocabulary, with Uzbek meanings.',
  appleWebApp: { capable: true, title: 'Karteikasten', statusBarStyle: 'default' },
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
