import { describe, expect, it } from 'vitest';
import { drawTopic, GEMINI_URL, geminiPrompt, SPEAKING_CARDS, SPEAKING_LESSONS, speakingCard } from './sprechkarten';

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

  it('puts the topic first, then feedback after every answer and a summary on "finish"', () => {
    const card = speakingCard('4.1')!;
    const uz = geminiPrompt(card, 'uz');
    expect(uz.split('\n')[0]).toBe('🎤 GAPIRISH MAVZUSI: „Wie findest du dein Zimmer?“');
    expect(uz.split('\n')[1]).toBe('(Momente A1.1 · Lektion 4 · Möbel und Preise · kartochka 4.1)');
    expect(uz).toContain('HAR BIR javobimdan keyin darhol');
    for (const word of ['„finish“', '„Fertig“', '„tugadi“']) expect(uz).toContain(word);
    const en = geminiPrompt(card, 'en');
    expect(en.split('\n')[0]).toBe('🎤 SPEAKING TOPIC: „Wie findest du dein Zimmer?“');
    expect(en).toContain('After EVERY answer, right away');
    expect(en).toContain('“finish”');
    for (const p of [uz, en]) {
      // after each answer: mistake → correction, the corrected answer, a follow-up question
      for (const part of ['❌', '✅', '✍️', '➡️']) expect(p).toContain(part);
      // the summary on "finish": score, model answer, tips
      for (const part of ['📊', '🌟', '💡']) expect(p).toContain(part);
    }
    // A question with its own quotes isn't quoted again
    expect(geminiPrompt(speakingCard('5.3')!, 'uz').split('\n')[0]).toBe('🎤 GAPIRISH MAVZUSI: Wie heißt „ruchka“ auf Deutsch?');
  });

  it('opens plain Gemini: it doesn\'t take a message from a link, so the student pastes it', () => {
    expect(GEMINI_URL).toBe('https://gemini.google.com/app');
    for (const c of SPEAKING_CARDS) expect(geminiPrompt(c, 'uz').length).toBeLessThan(1500);
  });
});
