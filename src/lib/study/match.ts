/**
 * Making the week's study groups. Pure: the server passes the sign-ups, who blocked whom and a
 * random number generator (seedable in tests).
 *
 *   1. shuffle the sign-ups (the random part)
 *   2. take the next student without a group; add the one who shares the most free hours with
 *      them, then a third who shares the most hours with what those two have in common
 *   3. two left over who share an hour → a group of 2; one left over joins a group of 2 (→ 3)
 *      or a group of 3 (→ 4) they share hours with, else they get no group this week
 * Every group shares at least one free hour, and people who blocked each other are never together.
 * Greedy, O(n²) per pick: plenty for a class (the optimal answer would be a weighted matching).
 */
export interface Signup {
  userId: string;
  slots: readonly number[];
}

export interface StudyMatch {
  members: string[];
  slots: number[]; // the hours they all share, ascending
}

export const GROUP_SIZE = 3;
const MAX_SIZE = 4;

const shared = (a: ReadonlySet<number>, b: ReadonlySet<number>) => new Set([...a].filter((x) => b.has(x)));

/** A small seedable generator (mulberry32) for tests; the server uses Math.random. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeGroups(
  signups: readonly Signup[],
  blocked: (a: string, b: string) => boolean,
  random: () => number = Math.random,
): { groups: StudyMatch[]; unmatched: string[] } {
  // One sign-up per person, with at least one hour
  const free = new Map<string, Set<number>>();
  for (const s of signups) if (s.slots.length && !free.has(s.userId)) free.set(s.userId, new Set(s.slots));
  const order = [...free.keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const left = new Set(order);
  const groups: { members: string[]; common: Set<number> }[] = [];
  const alone: string[] = [];
  const fits = (who: string, members: string[]) => members.every((m) => !blocked(who, m) && !blocked(m, who));
  /** The one in `left` sharing the most of `hours` with no block against `members` (first in shuffled order wins ties). */
  const best = (hours: Set<number>, members: string[]) => {
    let pick: string | null = null;
    let most = 0;
    for (const c of left) {
      if (!fits(c, members)) continue;
      const n = shared(hours, free.get(c)!).size;
      if (n > most) [pick, most] = [c, n];
    }
    return pick;
  };

  for (const s of order) {
    if (!left.has(s)) continue;
    left.delete(s);
    const p = best(free.get(s)!, [s]);
    if (!p) {
      alone.push(s);
      continue;
    }
    left.delete(p);
    const common = shared(free.get(s)!, free.get(p)!);
    const q = best(common, [s, p]);
    if (q) left.delete(q);
    groups.push({ members: q ? [s, p, q] : [s, p], common: q ? shared(common, free.get(q)!) : common });
  }

  // Leftovers: fill groups of 2 first, then make a 4
  const unmatched: string[] = [];
  for (const s of alone) {
    const mine = free.get(s)!;
    let target: (typeof groups)[number] | null = null;
    let most = 0;
    for (const size of [2, GROUP_SIZE]) {
      for (const g of groups) {
        if (g.members.length !== size || g.members.length >= MAX_SIZE || !fits(s, g.members)) continue;
        const n = shared(g.common, mine).size;
        if (n > most) [target, most] = [g, n];
      }
      if (target) break;
    }
    if (!target) {
      unmatched.push(s);
      continue;
    }
    target.members.push(s);
    target.common = shared(target.common, mine);
  }

  return {
    groups: groups.map((g) => ({ members: g.members, slots: [...g.common].sort((a, b) => a - b) })),
    unmatched,
  };
}
