import Link from 'next/link';
import { HOME_FAQ } from '@/lib/seo';

/**
 * Under the welcome cards on /: what Karteikasten is, in Uzbek (open), Russian and English
 * (folded). Rendered on the server, so search engines read it in the page itself, with plain
 * links to the courses. Real text people can read; nothing hidden only for search engines.
 */
const FEATURES: [string, string][] = [
  ['Aqlli kartochkalar', 'Har bir soʻz unutishingizdan oldin qaytib keladi (SM-2 takrorlash tizimi). Oʻzbekcha tarjima, misol gap va talaffuz bilan.'],
  ['der, die yoki das?', 'Nemis otlarining artiklini alohida mashq qiling: rangli belgilar bilan tez eslab qolasiz.'],
  ['A1 sinov testlari', 'Momente A1.1 boʻyicha 4 ta Wiederholungstest va Abschlusstest: Grammatik, Lesen, Schreiben, Sprechen. Yozish va gapirishni sunʼiy intellekt tekshiradi.'],
  ['Gapirish mashqi', '60 ta Sprechkarte (1–10-darslar): mavzu oling va Gemini bilan gapiring, har bir javobingiz tuzatiladi.'],
  ['Birga oʻrganamiz', 'Boʻsh vaqtingizni belgilang: har yakshanba 3 kishilik guruh va shaxsiy chat tuziladi.'],
  ['Telegram eslatma', 'Mashq qilmagan kuningiz kechqurun bitta eslatma keladi: seriyangiz va nechta kartochka kutayotgani.'],
];

export function HomeAbout() {
  return (
    <section className="about" aria-labelledby="about-h">
      <div className="about-in">
        <h2 id="about-h">Nemis va ingliz tilini oʻzbekcha tarjima bilan oʻrganing</h2>
        <p className="about-lede">
          Karteikasten — til oʻrganuvchilar uchun bepul ilova: soʻzlarni kartochkalarda yodlang, imtihon formatidagi testlarni
          ishlang va sinfdoshlaringiz bilan birga mashq qiling. Roʻyxatdan oʻtmasdan ham sinab koʻrish mumkin.
        </p>
        <ul className="about-features">
          {FEATURES.map(([title, text]) => (
            <li key={title}><h3>{title}</h3><p>{text}</p></li>
          ))}
        </ul>
        <p className="about-links">
          <Link href="/german">Nemis tili (Momente A1, Goethe A1) →</Link>
          <Link href="/english">Ingliz tili soʻzlari (A1–B2) →</Link>
        </p>

        <h3 className="about-faq-h">Koʻp beriladigan savollar</h3>
        <dl className="about-faq">
          {HOME_FAQ.map(({ q, a }) => (
            <div key={q}><dt>{q}</dt><dd>{a}</dd></div>
          ))}
        </dl>

        <details className="about-lang" lang="ru">
          <summary>На русском</summary>
          <p>
            Karteikasten — бесплатное приложение для изучения немецкого и английского языка с узбекским переводом: карточки с
            интервальным повторением, тренировка артиклей der/die/das, пробные тесты A1 (Grammatik, Lesen, Schreiben, Sprechen) по
            учебнику Momente A1 для подготовки к экзамену Goethe A1, 60 карточек для разговорной практики с Gemini и учебные
            группы. Работает в браузере на телефоне и компьютере, без оплаты.
          </p>
          <p className="about-links">
            <Link href="/german">Немецкий язык A1 (Momente) →</Link>
            <Link href="/english">Английские слова A1–B2 →</Link>
          </p>
        </details>
        <details className="about-lang" lang="en">
          <summary>In English</summary>
          <p>
            Karteikasten is a free app for Uzbek speakers learning German and English: spaced-repetition flashcards with Uzbek
            translations, der/die/das practice, A1 mock tests (Grammatik, Lesen, Schreiben, Sprechen) based on Momente A1 to prepare
            for the Goethe A1 exam, 60 speaking cards to practise with Gemini, and weekly study groups. Works in the browser on your
            phone or computer, free of charge.
          </p>
          <p className="about-links">
            <Link href="/german">German A1 (Momente) →</Link>
            <Link href="/english">English vocabulary A1–B2 →</Link>
          </p>
        </details>
      </div>
    </section>
  );
}
