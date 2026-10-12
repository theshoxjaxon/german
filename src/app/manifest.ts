import type { MetadataRoute } from 'next';

/** Lets you add the app to your phone's home screen and open it full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Karteikasten',
    short_name: 'Karteikasten',
    description: 'Spaced-repetition flashcards and a word database for German vocabulary.',
    start_url: '/',
    display: 'standalone',
    background_color: '#e8ecf1',
    theme_color: '#e8ecf1',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
