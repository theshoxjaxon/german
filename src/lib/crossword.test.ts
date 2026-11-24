import { describe, expect, it } from 'vitest';
import { buildCrossword, crosswordWord, fold, gridCells, MAX_SIZE, MIN_WORDS } from './crossword';
import { packWords, SEED_PACKS } from './seed';

const lesson = (...decks: string[]) =>
  SEED_PACKS.filter((p) => p.course === 'german' && decks.includes(p.deck))
    .flatMap((p) => Object.values(packWords(p)));

describe('crossword', () => {
  it('folds umlauts and ß letter for letter', () => {
    expect(fold('Größe')).toBe('GROSE');
    expect(fold('Fuß')).toBe('FUS');
    expect(fold('für')).toBe('FUR');
    expect(crosswordWord('der Fuß')).toBe('Fuß');
    expect(crosswordWord('(nach) rechts')).toBeNull();
    expect(crosswordWord('Was ist los?')).toBeNull();
  });

  it('builds a valid grid from the real lessons, for many seeds', () => {
    const words = lesson('Lektion 15', 'Lektion 16');
    for (let seed = 1; seed <= 25; seed++) {
      const cw = buildCrossword(words, seed)!;
      expect(cw).not.toBeNull();
      expect(cw.entries.length).toBeGreaterThanOrEqual(MIN_WORDS);
      expect(cw.rows).toBeLessThanOrEqual(MAX_SIZE);
      expect(cw.cols).toBeLessThanOrEqual(MAX_SIZE);

      const cells = gridCells(cw);
      // every entry reads back correctly from the grid and stays inside it
      for (const e of cw.entries) {
        for (let k = 0; k < e.answer.length; k++) {
          const r = e.row + (e.dir === 'down' ? k : 0), c = e.col + (e.dir === 'across' ? k : 0);
          expect(cells.get(`${r},${c}`)!.ch).toBe(e.answer[k]);
          expect(r).toBeLessThan(cw.rows);
          expect(c).toBeLessThan(cw.cols);
        }
      }
      // every word crosses another one in the other direction
      cw.entries.forEach((e, i) => {
        const crosses = Array.from(e.answer, (_, k) => cells.get(`${e.row + (e.dir === 'down' ? k : 0)},${e.col + (e.dir === 'across' ? k : 0)}`)!.entries)
          .some((list) => list.some((j) => j !== i && cw.entries[j].dir !== e.dir));
        expect(crosses).toBe(true);
      });
      // no letters touch sideways by accident: every run of 2+ cells is exactly one entry
      for (const dir of ['across', 'down'] as const) {
        for (let a = 0; a < (dir === 'across' ? cw.rows : cw.cols); a++) {
          let run = 0, start = 0;
          for (let b = 0; b <= (dir === 'across' ? cw.cols : cw.rows); b++) {
            const key = dir === 'across' ? `${a},${b}` : `${b},${a}`;
            if (cells.has(key)) { if (!run) start = b; run++; continue; }
            if (run > 1) {
              expect(cw.entries.some((e) => e.dir === dir && (dir === 'across' ? e.row === a && e.col === start : e.col === a && e.row === start) && e.answer.length === run)).toBe(true);
            }
            run = 0;
          }
        }
      }
    }
  });

  it('is repeatable for one seed and varies between seeds', () => {
    const words = lesson('Lektion 14', 'Lektion 15');
    const a = buildCrossword(words, 7)!, b = buildCrossword(words, 7)!, c = buildCrossword(words, 8)!;
    expect(a.entries.map((e) => e.answer)).toEqual(b.entries.map((e) => e.answer));
    expect(a.entries.map((e) => e.answer)).not.toEqual(c.entries.map((e) => e.answer));
  });

  it('says no when there are too few usable words', () => {
    expect(buildCrossword(lesson('Lektion 13').slice(0, 3), 1)).toBeNull();
  });
});
