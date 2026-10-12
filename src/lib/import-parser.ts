import { cleanTerm } from './text';

export interface ParsedList {
  pairs: { term: string; meaning: string }[];
  skipped: string[];
  deckHint: string; // e.g. "Lektion 4" when the list starts with that line
}

/** Separators between a word and its meaning: tab, spaced dash, =, ;, | or ": " */
const SEP = /\t+|\s+[–—-]\s+|\s*=\s*|\s*;\s*|\s*\|\s*|:\s+/;

/**
 * Parse a pasted word list. Accepts "word – meaning" lines (or tab, =, ;, |),
 * or a list where each meaning sits on the line below its word (what a PDF table often pastes as).
 */
export function parseList(text: string): ParsedList {
  let deckHint = '';
  const lines: string[] = [];
  for (const raw of String(text).split(/\r?\n/)) {
    let l = raw.replace(/ /g, ' ').trim();
    if (!l) continue;
    if (/^(lektion|lesson|kapitel|unit|dars)\s*\d+\s*$/i.test(l)) {
      deckHint = deckHint || l.replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase());
      continue;
    }
    l = l.replace(/^\d+\s*[.)]\s+/, ''); // "1. die Familie" → "die Familie"
    lines.push(l);
  }

  const pairs: ParsedList['pairs'] = [];
  const skipped: string[] = [];
  if (lines.some((l) => SEP.test(l))) {
    for (const l of lines) {
      const m = SEP.exec(l);
      const term = m ? l.slice(0, m.index).trim() : '';
      const meaning = m ? l.slice(m.index + m[0].length).trim() : '';
      if (term && meaning) pairs.push({ term, meaning });
      else skipped.push(l);
    }
  } else if (lines.length >= 2 && lines.length % 2 === 0) {
    for (let i = 0; i < lines.length; i += 2) pairs.push({ term: lines[i], meaning: lines[i + 1] });
  } else {
    skipped.push(...lines);
  }
  return { pairs: pairs.map((p) => ({ term: cleanTerm(p.term), meaning: p.meaning })), skipped, deckHint };
}

/** After "Lektion 3" comes "Lektion 4". */
export function suggestDeck(deckNames: string[]): string {
  const nums = deckNames
    .map((d) => /^lektion\s*(\d+)$/i.exec(d))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => +m[1]);
  return nums.length ? `Lektion ${Math.max(...nums) + 1}` : '';
}
