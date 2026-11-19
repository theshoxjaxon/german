import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Gentium_Book_Plus, JetBrains_Mono, Literata, Outfit } from 'next/font/google';
import './globals.css';
import './wordfield.css';

// Display face for German words on the cards
const literata = Literata({ subsets: ['latin', 'latin-ext'], axes: ['opsz'], variable: '--font-literata', display: 'swap' });
// UI face designed for legibility (clear I / l / 1)
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ['latin', 'latin-ext'], variable: '--font-atkinson', display: 'swap' });
// Numbers in tables and intervals
const atkinsonMono = Atkinson_Hyperlegible_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-atkinson-mono', display: 'swap' });
// IPA pronunciation symbols
const gentium = Gentium_Book_Plus({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-gentium', display: 'swap' });

// Wordfield look: Outfit for text, JetBrains Mono for codes and numbers
const outfit = Outfit({ subsets: ['latin', 'latin-ext'], variable: '--font-outfit', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: 'Wordfield',
  description: 'Pick a language and start swiping: spaced-repetition flashcards, daily decks and friend streaks.',
  appleWebApp: { capable: true, title: 'Wordfield', statusBarStyle: 'default' },
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
    <html lang="en" className={`${literata.variable} ${atkinson.variable} ${atkinsonMono.variable} ${gentium.variable} ${outfit.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
