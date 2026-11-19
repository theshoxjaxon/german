/**
 * The German Perfekt (haben/sein + Partizip II), as taught in Momente A1: the verbs, which rule
 * forms each one's Partizip II, and the practice content (sentences to build, Präsens sentences
 * to turn into the Perfekt). Pure data and functions, used by the browser and the server alike.
 * The lesson verbs themselves come from the course's word lists (see ./verbs.ts, server only).
 */

/** How a verb makes its Partizip II. */
export type VerbKind = 'regular' | 'separable' | 'ieren' | 'inseparable' | 'irregular';
/** The five things a student learns, each with its own progress bar. */
export type RuleId = 'regular' | 'separable' | 'noGe' | 'irregular' | 'aux';
export const RULES: RuleId[] = ['regular', 'separable', 'noGe', 'irregular', 'aux'];
export type Aux = 'haben' | 'sein';

export interface Verb {
  id: string;
  inf: string; // the infinitive, with "sich" for reflexive verbs
  meaning: string;
  aux: Aux;
  p: string; // the Partizip II, without "sich"
  kind: VerbKind;
  lesson: string; // "Lektion 4", or "" for the extra verbs below
}

export const ruleOf = (kind: VerbKind): RuleId => (kind === 'ieren' || kind === 'inseparable' ? 'noGe' : kind);

/** The Partizip II in parts, to colour like the class notes: the prefix, ge-, and the ending. */
export function partizipParts(v: Verb): { text: string; mark?: 'pre' | 'ge' | 'end' }[] {
  const out: { text: string; mark?: 'pre' | 'ge' | 'end' }[] = [];
  let rest = v.p;
  const pre = v.kind === 'separable' ? separablePrefix(v.inf, v.p) : '';
  if (pre) {
    out.push({ text: pre, mark: 'pre' });
    rest = rest.slice(pre.length);
  }
  if (rest.startsWith('ge') && v.kind !== 'inseparable') {
    out.push({ text: 'ge', mark: 'ge' });
    rest = rest.slice(2);
  }
  const end = rest.match(/(et|t|en)$/)?.[1] ?? '';
  if (end && rest.length > end.length) out.push({ text: rest.slice(0, -end.length) }, { text: end, mark: 'end' });
  else out.push({ text: rest });
  return out;
}

/** What the AI says about a few sentences written in the Perfekt. */
export interface PerfektCheck {
  sentences: number;
  perfekt: number; // sentences with a correct Perfekt
  corrections: { wrong: string; right: string; why: string }[];
  corrected: string;
  summary: string;
  tip: string;
}

/** Separable prefixes, longest first so "zurück" wins over "zu". */
const SEPARABLE = ['zusammen', 'zurück', 'weiter', 'fern', 'nach', 'auf', 'aus', 'ein', 'mit', 'vor', 'weg', 'los', 'ab', 'an', 'um', 'zu'];
const INSEPARABLE = ['be', 'ver', 'er', 'ent', 'emp', 'zer', 'miss', 'ge'];

const bare = (s: string) => s.replace(/^sich\s+/, '');
export const stemOf = (inf: string) => (inf.endsWith('en') ? inf.slice(0, -2) : inf.endsWith('n') ? inf.slice(0, -1) : inf);

/** The regular ending: -et after t, d, or a consonant + m/n (arbeit-et, zeichn-et), otherwise -t. */
export function weakEnding(stem: string): string {
  return stem + (/([td]|(ch|[^aeiouäöülrhmn])[mn])$/.test(stem) ? 'et' : 't');
}

/** The separable prefix of a verb, if its Partizip has ge- after it (ein|ge|kauft). */
export function separablePrefix(inf: string, p: string): string {
  const v = bare(inf);
  return SEPARABLE.find((pre) => v.startsWith(pre) && v.length > pre.length + 2 && p.startsWith(`${pre}ge`)) ?? '';
}

/** Which rule makes this verb's Partizip II. */
export function classify(inf: string, partizip: string): VerbKind {
  const v = bare(inf);
  const p = bare(partizip);
  if (v.endsWith('ieren')) return 'ieren';
  if (separablePrefix(v, p)) return 'separable';
  if ((INSEPARABLE.some((pre) => v.startsWith(pre)) && !p.startsWith('ge')) || (v.startsWith('ge') && p === v)) return 'inseparable';
  if (p === `ge${weakEnding(stemOf(v))}`) return 'regular';
  return 'irregular';
}

/** Read "er kauft · kaufte · hat gekauft" (the "forms" of a word card) into its helper verb and Partizip. */
export function parseForms(forms: string): { aux: Aux; p: string } | null {
  const m = forms.match(/·\s*(hat|ist)\s+(?:sich\s+)?([a-zäöüß]+)\s*$/);
  return m ? { aux: m[1] === 'ist' ? 'sein' : 'haben', p: m[2] } : null;
}

/** Common verbs the class uses that aren't on the word lists. */
const EXTRA: [inf: string, meaning: string, aux: Aux, p: string][] = [
  ['machen', 'qilmoq', 'haben', 'gemacht'],
  ['spielen', 'oʻynamoq', 'haben', 'gespielt'],
  ['hören', 'eshitmoq, tinglamoq', 'haben', 'gehört'],
  ['frühstücken', 'nonushta qilmoq', 'haben', 'gefrühstückt'],
  ['duschen', 'dush qabul qilmoq', 'haben', 'geduscht'],
  ['aufstehen', 'oʻrnidan turmoq', 'sein', 'aufgestanden'],
  ['fliegen', 'uchmoq (samolyotda)', 'sein', 'geflogen'],
  ['reisen', 'sayohat qilmoq', 'sein', 'gereist'],
  ['helfen', 'yordam bermoq', 'haben', 'geholfen'],
  ['bezahlen', 'toʻlamoq', 'haben', 'bezahlt'],
  ['erzählen', 'aytib bermoq', 'haben', 'erzählt'],
];
/** Modal verbs: their Perfekt is rare at A1, so they aren't drilled. */
const SKIP = new Set(['können', 'mögen', 'möchten', 'müssen', 'wollen', 'dürfen', 'sollen']);

/** Build the verb list from word rows (id, infinitive, meaning, forms), plus the extra verbs. */
export function buildVerbs(rows: { id: string; term: string; meaning: string; forms: string; deck: string }[]): Verb[] {
  const out: Verb[] = [];
  const seen = new Set<string>();
  const add = (v: Verb) => {
    if (seen.has(v.inf) || SKIP.has(v.inf)) return;
    seen.add(v.inf);
    out.push(v);
  };
  for (const r of rows) {
    const f = parseForms(r.forms);
    if (!f || /\s/.test(bare(r.term))) continue; // "Rad fahren" and the like: the plain verb is enough
    add({ id: r.id, inf: r.term, meaning: r.meaning, aux: f.aux, p: f.p, kind: classify(r.term, f.p), lesson: r.deck });
  }
  for (const [inf, meaning, aux, p] of EXTRA) add({ id: `x-${inf}`, inf, meaning, aux, p, kind: classify(inf, p), lesson: '' });
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* Sentences to build from tiles. Tiles are in the plain order (subject first): any one tile may
 * go in front, the helper verb comes second, the rest keeps this order, the Partizip goes last. */

export type TileRole = 's' | 'aux' | 'x' | 'p';
export interface Tile {
  w: string; // as it stands inside the sentence ("er", not "Er")
  r: TileRole;
}
export interface OrderSentence {
  id: string;
  tiles: Tile[];
  wrongAux: string; // the other helper verb in the same person, offered as a decoy
  verb: string; // the infinitive
  uz: string; // what it means
}

const s = (w: string): Tile => ({ w, r: 's' });
const a = (w: string): Tile => ({ w, r: 'aux' });
const x = (w: string): Tile => ({ w, r: 'x' });
const p = (w: string): Tile => ({ w, r: 'p' });

export const SENTENCES: OrderSentence[] = [
  { id: 's1', tiles: [s('er'), a('hat'), x('gestern'), x('Fußball'), p('gespielt')], wrongAux: 'ist', verb: 'spielen', uz: 'U kecha futbol oʻynadi.' },
  { id: 's2', tiles: [s('ich'), a('habe'), x('am Wochenende'), p('eingekauft')], wrongAux: 'bin', verb: 'einkaufen', uz: 'Men dam olish kuni xarid qildim.' },
  { id: 's3', tiles: [s('wir'), a('haben'), x('Pizza'), p('gegessen')], wrongAux: 'sind', verb: 'essen', uz: 'Biz pitsa yedik.' },
  { id: 's4', tiles: [s('sie'), a('ist'), x('gestern'), x('nach Berlin'), p('gefahren')], wrongAux: 'hat', verb: 'fahren', uz: 'U kecha Berlinga ketdi.' },
  { id: 's5', tiles: [s('ich'), a('habe'), x('heute'), x('mein Zimmer'), p('aufgeräumt')], wrongAux: 'bin', verb: 'aufräumen', uz: 'Men bugun xonamni yigʻishtirdim.' },
  { id: 's6', tiles: [s('er'), a('hat'), x('mit seiner Mutter'), p('telefoniert')], wrongAux: 'ist', verb: 'telefonieren', uz: 'U onasi bilan telefonda gaplashdi.' },
  { id: 's7', tiles: [s('Anna'), a('hat'), x('in Wien'), p('studiert')], wrongAux: 'ist', verb: 'studieren', uz: 'Anna Venada oʻqidi.' },
  { id: 's8', tiles: [s('ich'), a('habe'), x('am Sonntag'), x('lange'), p('geschlafen')], wrongAux: 'bin', verb: 'schlafen', uz: 'Men yakshanba kuni uzoq uxladim.' },
  { id: 's9', tiles: [s('wir'), a('sind'), x('am Abend'), x('ins Kino'), p('gegangen')], wrongAux: 'haben', verb: 'gehen', uz: 'Biz kechqurun kinoga bordik.' },
  { id: 's10', tiles: [s('du'), a('hast'), x('einen Kuchen'), p('gebacken')], wrongAux: 'bist', verb: 'backen', uz: 'Sen pirog pishirding.' },
  { id: 's11', tiles: [s('mein Vater'), a('hat'), x('heute'), x('Plov'), p('gekocht')], wrongAux: 'ist', verb: 'kochen', uz: 'Otam bugun palov pishirdi.' },
  { id: 's12', tiles: [s('Lena'), a('hat'), x('gestern'), x('ein Buch'), p('gelesen')], wrongAux: 'ist', verb: 'lesen', uz: 'Lena kecha kitob oʻqidi.' },
  { id: 's13', tiles: [s('ihr'), a('habt'), x('Musik'), p('gehört')], wrongAux: 'seid', verb: 'hören', uz: 'Sizlar musiqa tingladingiz.' },
  { id: 's14', tiles: [s('der Zug'), a('ist'), x('um acht Uhr'), p('angekommen')], wrongAux: 'hat', verb: 'ankommen', uz: 'Poyezd soat sakkizda yetib keldi.' },
  { id: 's15', tiles: [s('ich'), a('habe'), x('am Samstag'), x('meine Oma'), p('besucht')], wrongAux: 'bin', verb: 'besuchen', uz: 'Men shanba kuni buvimni koʻrgani bordim.' },
  { id: 's16', tiles: [s('wir'), a('haben'), x('gestern'), x('den Geburtstag'), p('gefeiert')], wrongAux: 'sind', verb: 'feiern', uz: 'Biz kecha tugʻilgan kunni nishonladik.' },
  { id: 's17', tiles: [s('Maria'), a('ist'), x('in Frankfurt'), p('umgestiegen')], wrongAux: 'hat', verb: 'umsteigen', uz: 'Mariya Frankfurtda boshqa poyezdga oʻtdi.' },
  { id: 's18', tiles: [s('ich'), a('habe'), x('im Urlaub'), x('viele Fotos'), p('gemacht')], wrongAux: 'bin', verb: 'machen', uz: 'Men taʼtilda koʻp surat oldim.' },
  { id: 's19', tiles: [s('die Kinder'), a('haben'), x('im Garten'), p('gespielt')], wrongAux: 'sind', verb: 'spielen', uz: 'Bolalar bogʻda oʻynashdi.' },
  { id: 's20', tiles: [s('ich'), a('habe'), x('am Samstag'), x('das Bad'), p('geputzt')], wrongAux: 'bin', verb: 'putzen', uz: 'Men shanba kuni hammomni tozaladim.' },
  { id: 's21', tiles: [s('wir'), a('sind'), x('am Sonntag'), p('gewandert')], wrongAux: 'haben', verb: 'wandern', uz: 'Biz yakshanba kuni togʻda sayr qildik.' },
  { id: 's22', tiles: [s('er'), a('hat'), x('heute Morgen'), x('Kaffee'), p('getrunken')], wrongAux: 'ist', verb: 'trinken', uz: 'U bugun ertalab qahva ichdi.' },
  { id: 's23', tiles: [s('ich'), a('bin'), x('gestern'), x('zu Hause'), p('geblieben')], wrongAux: 'habe', verb: 'bleiben', uz: 'Men kecha uyda qoldim.' },
  { id: 's24', tiles: [s('sie'), a('hat'), x('ihrer Freundin'), x('eine E-Mail'), p('geschrieben')], wrongAux: 'ist', verb: 'schreiben', uz: 'U dugonasiga xat yozdi.' },
  { id: 's25', tiles: [s('ich'), a('habe'), x('am Abend'), p('ferngesehen')], wrongAux: 'bin', verb: 'fernsehen', uz: 'Men kechqurun televizor koʻrdim.' },
];

/** The sentence with the plain word order, as it should be written: "Er hat gestern Fußball gespielt." */
export function writeTiles(tiles: Tile[]): string {
  const text = tiles.map((t) => t.w).join(' ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/* ------------------------------------------------------------------------------------------ */
/* Präsens → Perfekt. The answer keeps the words of the Präsens sentence. */

export interface Transform {
  id: string;
  present: string;
  perfekt: string;
  verb: string; // the infinitive
}

export const TRANSFORMS: Transform[] = [
  { id: 't1', present: 'Ich kaufe ein Handy.', perfekt: 'Ich habe ein Handy gekauft.', verb: 'kaufen' },
  { id: 't2', present: 'Er spielt Fußball.', perfekt: 'Er hat Fußball gespielt.', verb: 'spielen' },
  { id: 't3', present: 'Wir essen Pizza.', perfekt: 'Wir haben Pizza gegessen.', verb: 'essen' },
  { id: 't4', present: 'Ich schlafe lange.', perfekt: 'Ich habe lange geschlafen.', verb: 'schlafen' },
  { id: 't5', present: 'Sie telefoniert mit Anna.', perfekt: 'Sie hat mit Anna telefoniert.', verb: 'telefonieren' },
  { id: 't6', present: 'Ich kaufe im Supermarkt ein.', perfekt: 'Ich habe im Supermarkt eingekauft.', verb: 'einkaufen' },
  { id: 't7', present: 'Du räumst dein Zimmer auf.', perfekt: 'Du hast dein Zimmer aufgeräumt.', verb: 'aufräumen' },
  { id: 't8', present: 'Er fährt nach Taschkent.', perfekt: 'Er ist nach Taschkent gefahren.', verb: 'fahren' },
  { id: 't9', present: 'Wir gehen ins Kino.', perfekt: 'Wir sind ins Kino gegangen.', verb: 'gehen' },
  { id: 't10', present: 'Anna studiert in Berlin.', perfekt: 'Anna hat in Berlin studiert.', verb: 'studieren' },
  { id: 't11', present: 'Ich mache Hausaufgaben.', perfekt: 'Ich habe Hausaufgaben gemacht.', verb: 'machen' },
  { id: 't12', present: 'Mein Bruder liest ein Buch.', perfekt: 'Mein Bruder hat ein Buch gelesen.', verb: 'lesen' },
  { id: 't13', present: 'Ihr trinkt Tee.', perfekt: 'Ihr habt Tee getrunken.', verb: 'trinken' },
  { id: 't14', present: 'Der Zug kommt um acht Uhr an.', perfekt: 'Der Zug ist um acht Uhr angekommen.', verb: 'ankommen' },
  { id: 't15', present: 'Ich besuche meine Oma.', perfekt: 'Ich habe meine Oma besucht.', verb: 'besuchen' },
  { id: 't16', present: 'Sie bleibt zu Hause.', perfekt: 'Sie ist zu Hause geblieben.', verb: 'bleiben' },
  { id: 't17', present: 'Wir hören Musik.', perfekt: 'Wir haben Musik gehört.', verb: 'hören' },
  { id: 't18', present: 'Er schreibt eine E-Mail.', perfekt: 'Er hat eine E-Mail geschrieben.', verb: 'schreiben' },
  { id: 't19', present: 'Ich stehe um sieben Uhr auf.', perfekt: 'Ich bin um sieben Uhr aufgestanden.', verb: 'aufstehen' },
  { id: 't20', present: 'Du verstehst die Frage.', perfekt: 'Du hast die Frage verstanden.', verb: 'verstehen' },
  { id: 't21', present: 'Meine Mutter kocht Plov.', perfekt: 'Meine Mutter hat Plov gekocht.', verb: 'kochen' },
  { id: 't22', present: 'Wir sehen fern.', perfekt: 'Wir haben ferngesehen.', verb: 'fernsehen' },
];

export const sentence = (id: string) => SENTENCES.find((x) => x.id === id);
export const transform = (id: string) => TRANSFORMS.find((x) => x.id === id);

/** The forms of haben and sein, so a wrong helper verb or person can be told apart. */
export const AUX_FORMS: Record<Aux, string[]> = {
  haben: ['habe', 'hast', 'hat', 'haben', 'habt'],
  sein: ['bin', 'bist', 'ist', 'sind', 'seid'],
};
