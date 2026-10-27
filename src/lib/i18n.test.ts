/**
 * Every text the student-facing code shows through t() / tn(), every toast, store message and
 * server message a student can see, and every label list must have an Uzbek entry with the same
 * {placeholders}. Admin pages stay English on purpose and aren't checked.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { span, translate, translateCount } from './i18n';
import { UZ } from './i18n-uz';
import { CHEERS, MAX_OWN_WORDS, POS_OPTIONS, RATING_LABEL } from './types';
import { FILTER_LABEL, SORTS, STATUS_OPTS } from './words-view';

const SRC = join(__dirname, '..');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
const walk = (dir: string): string[] =>
  readdirSync(join(SRC, dir)).flatMap((f) => {
    const p = join(dir, f);
    return statSync(join(SRC, p)).isDirectory() ? walk(p) : [p];
  });

/**
 * The texts in one argument of a call. Handles ternaries like t(a ? 'x' : 'y'), and skips what is
 * compared or indexed rather than shown: role === 'admin', Word['pos'].
 */
function literals(code: string): string[] {
  const out: string[] = [];
  const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([^`$]*)`/g;
  for (let m; (m = re.exec(code)); ) {
    if (/(===|!==|\[)\s*$/.test(code.slice(0, m.index))) continue;
    out.push(m[1] ?? m[2] ?? m[3]);
  }
  return out;
}

/** Split the arguments of each `name(` call at the top level, skipping strings. */
function calls(source: string, name: string): string[][] {
  const out: string[][] = [];
  const re = new RegExp(`(?<![\\w.])${name}\\(`, 'g');
  for (let m; (m = re.exec(source)); ) {
    let depth = 1;
    let i = m.index + m[0].length;
    let arg = '';
    const args: string[] = [];
    let quote = '';
    for (; i < source.length && depth > 0; i++) {
      const c = source[i];
      if (quote) {
        arg += c;
        if (c === '\\') arg += source[++i];
        else if (c === quote) quote = '';
        continue;
      }
      if (c === "'" || c === '"' || c === '`') quote = c;
      else if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
      if (depth === 1 && c === ',') {
        args.push(arg);
        arg = '';
        continue;
      }
      if (depth > 0) arg += c;
    }
    args.push(arg);
    out.push(args);
  }
  return out;
}

const studentFiles = [
  ...walk('components').filter((f) => /\.tsx?$/.test(f) && !f.includes('admin')),
  ...walk('lib/client').filter((f) => f.endsWith('.ts')),
];

function wanted(): Set<string> {
  const keys = new Set<string>();
  const add = (s: string | undefined) => s && /[A-Za-z]/.test(s) && keys.add(s);
  for (const f of studentFiles) {
    const src = read(f).replace(/^\s*(\/\*\*|\*|\/\/).*$/gm, ''); // not comments
    for (const args of calls(src, 't')) literals(args[0]).forEach(add);
    for (const args of calls(src, 'tn')) [args[1], args[2]].forEach((a) => a && literals(a).forEach(add));
    for (const args of calls(src, 'toast')) literals(args[0]).filter((s) => /^[A-Z]/.test(s)).forEach(add);
    for (const args of calls(src, 'report')) literals(args[0]).forEach(add);
    for (const args of calls(src, 'saveError')) literals(args[1] ?? '').forEach(add);
    // Label lists inside components: { label: '…' }, { title: '…', text: '…' }, ['de-DE', 'German (Germany)'], …
    for (const m of src.matchAll(/\b(?:label|title|text|short|unit):\s*(?:\([^)]*\)\s*=>\s*)?'([^']+)'/g)) add(m[1]);
    for (const m of src.matchAll(/'[a-z]{2}-[A-Z]{2}', '([^']+)'/g)) add(m[1]);
    for (const m of src.matchAll(/\['[fr]', '([^']+)', '([^']+)'\]/g)) [m[1], m[2]].forEach(add);
    for (const m of src.matchAll(/\? '(word|answer|day)' : '(words|answers|days)'/g)) [m[1], m[2]].forEach(add);
  }
  // Fixed label lists used across the app
  Object.values(RATING_LABEL).forEach(add);
  Object.values(CHEERS).forEach(add);
  POS_OPTIONS.forEach(([, l]) => add(l));
  STATUS_OPTS.forEach(([, l]) => add(l));
  Object.values(FILTER_LABEL).forEach(add);
  Object.values(SORTS).forEach((s) => [s?.label, s?.short].forEach(add));
  for (const line of read('components/StatsView.tsx').match(/FACH_RANGE = \[([^\]]*)\]/)![1].split(',')) add(literals(line)[0]);
  for (const m of read('components/ui.tsx').match(/STATUS_LABEL = \{([^}]*)\}/)![1].matchAll(/'([^']+)'/g)) add(m[1]);
  // Messages that come from the server or shared rules and are shown through t()
  const messageFiles = [
    'app/actions/auth.ts', 'lib/account-rules.ts', 'lib/server/ai.ts', 'lib/client/ai.ts',
    'app/api/class/join/route.ts', 'app/api/ai/words/route.ts', 'app/api/class/route.ts', 'app/api/cheers/route.ts',
    'app/api/words/[id]/route.ts', 'app/api/cards/[id]/route.ts',
  ];
  for (const f of messageFiles) {
    for (const s of literals(read(f))) if (/^[A-Z][^{}]*[a-z][^{}]*[.!?]$/.test(s) && s.includes(' ')) add(s);
  }
  add(`You can have up to ${MAX_OWN_WORDS} of your own words.`);
  return keys;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
// Technical texts nobody sees in the student app (they mean a broken request, not a person's mistake)
const IGNORE = /^(Send \{|Expected \{|Invalid |Too many cards|Cross-site|Sign in to continue|Only admins|The AI answer had|Karteikasten AI:)/;

describe('Uzbek interface', () => {
  const keys = [...wanted()].filter((k) => !IGNORE.test(k));

  it('finds the texts to check', () => {
    expect(keys.length).toBeGreaterThan(400);
    expect(keys).toContain('Study now');
    expect(keys).toContain('{n} card is still waiting for today.');
    expect(keys).toContain('Wrong username or password.');
  });

  it('has an Uzbek entry for every text the app shows', () => {
    expect(keys.filter((k) => !(k in UZ))).toEqual([]);
  });

  it('keeps the same {placeholders} in every translation', () => {
    const bad = Object.entries(UZ).filter(([en, uz]) => placeholders(en).join() !== placeholders(uz).join());
    expect(bad).toEqual([]);
  });

  it('uses the official letters oʻ and gʻ', () => {
    expect(Object.values(UZ).filter((v) => /[oOgG][‘'`’]/.test(v))).toEqual([]);
  });

  it('translates, fills in values, and falls back to English', () => {
    expect(translate('uz', 'Study now')).toBe('Hozir oʻrganish');
    expect(translate('en', 'Study now')).toBe('Study now');
    expect(translate('uz', 'Not in the dictionary')).toBe('Not in the dictionary');
    expect(translateCount('en', 1, '{n} word ready', '{n} words ready')).toBe('1 word ready');
    expect(translateCount('en', 3, '{n} word ready', '{n} words ready')).toBe('3 words ready');
    expect(translateCount('uz', 3, '{n} word ready', '{n} words ready')).toBe('3 ta soʻz tayyor');
    expect(span('en', 10 * 60_000)).toBe('10m');
    expect(span('uz', 4 * 86_400_000)).toBe('4 kun');
    expect(span('uz', 70 * 86_400_000)).toBe('2,3 oy');
  });
});
