import { describe, expect, it } from 'vitest';
import { drawTopic, geminiPrompt, geminiUrl, SPEAKING_CARDS, SPEAKING_LESSONS, speakingCard } from './sprechkarten';

describe('the 60 speaking cards', () => {
  it('has 6 cards for each of Lektion 1–10, as on the sheet', () => {
    expect(SPEAKING_CARDS).toHaveLength(60);
    expect(new Set(SPEAKING_CARDS.map((c) => c.id)).size).toBe(60);
    for (let l = 1; l <= 10; l++) {
      expect(SPEAKING_CARDS.filter((c) => c.lesson === l).map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `${l}.${n}`));
      expect(SPEAKING_LESSONS[l].title).toBeTruthy();
    }
    for (const c of SPEAKING_CARDS) {
      expect(c.question).toMatch(/[?!)]$/); // 5.1 ends "(Zeig auf ein Ding.)", as printed
      expect(c.hint.length).toBeGreaterThan(3);
    }
    expect(speakingCard('4.1')).toMatchObject({ question: 'Wie findest du dein Zimmer?', hint: 'Ich finde es schön / klein / praktisch.' });
    expect(speakingCard('11.1')).toBeNull();
  });

  it('draws any card, but never the one you just had', () => {
    expect(drawTopic(null, () => 0).id).toBe('1.1');
    expect(drawTopic('1.1', () => 0).id).toBe('1.2');
    expect(drawTopic(null, () => 0.9999).id).toBe('10.6');
    for (let i = 0; i < 200; i++) expect(drawTopic('7.3').id).not.toBe('7.3');
  });

  it('gives Gemini its role, the topic, the "Fertig" rule and the feedback to give', () => {
    const card = speakingCard('4.1')!;
    const uz = geminiPrompt(card, 'uz');
    expect(uz).toContain('Rol: Siz nemis tili A1');
    expect(uz).toContain('Mavzu (kartochka 4.1, Lektion 4 · Möbel und Preise): „Wie findest du dein Zimmer?“');
    expect(uz).toContain('„Fertig“');
    for (const part of ['✅', '❌', '✍️', '🌟', '📊', '💡']) expect(uz).toContain(part);
    const en = geminiPrompt(card, 'en');
    expect(en).toContain('Role: You are my speaking partner and examiner');
    expect(en).toContain('explanations in English');
    expect(en).toContain('„Wie findest du dein Zimmer?“');
    // A question with its own quotes isn't quoted again
    expect(geminiPrompt(speakingCard('5.3')!, 'uz')).toContain('Dinge und Farben): Wie heißt „ruchka“ auf Deutsch?\n');
  });

  it('fits every prompt in a Gemini link', () => {
    for (const c of SPEAKING_CARDS) {
      for (const lang of ['uz', 'en'] as const) {
        const url = geminiUrl(geminiPrompt(c, lang));
        expect(url.startsWith('https://gemini.google.com/app?q=')).toBe(true);
        expect(decodeURIComponent(url.split('?q=')[1])).toBe(geminiPrompt(c, lang));
        expect(url.length).toBeLessThan(2048); // the longest is about 1,990
      }
    }
  });
});
