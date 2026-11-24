// ponytail: Momente A1.1 = Lektion 1-12, A1.2 starts at 13 (Lektion 13 = A1.2 Lektion 1); a third book needs one more row here.
export const BOOKS = [{ name: 'Momente A1.1', from: 1, to: 12 }, { name: 'Momente A1.2', from: 13, to: 24 }];

/** "Lektion 15" → 15; null for any other deck (levels like A1, your own decks). */
export const lektionNumber = (deck: string) => {
  const m = /^lektion\s+(\d+)$/i.exec(deck.trim());
  return m ? Number(m[1]) : null;
};
