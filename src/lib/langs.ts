// The language grid on the home page. Only German and English have courses so far; the rest show
// "Coming soon". `course` is the address of the course (/german, /english).
export interface Lang { id: string; code: string; name: string; native: string; course?: string; targetLang?: 'de' | 'en' }

export const LANGS: Lang[] = [
  { id: 'de', code: 'DE', name: 'German', native: 'Deutsch', course: 'german', targetLang: 'de' },
  { id: 'en', code: 'EN', name: 'English', native: 'English', course: 'english', targetLang: 'en' },
  { id: 'es', code: 'ES', name: 'Spanish', native: 'Español' },
  { id: 'ja', code: 'JA', name: 'Japanese', native: '日本語' },
  { id: 'uz', code: 'UZ', name: 'Uzbek', native: 'O’zbekcha' },
  { id: 'fr', code: 'FR', name: 'French', native: 'Français' },
  { id: 'ko', code: 'KO', name: 'Korean', native: '한국어' },
  { id: 'it', code: 'IT', name: 'Italian', native: 'Italiano' },
];
