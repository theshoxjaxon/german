/**
 * "Frag mich was!": the class's 60 speaking cards (Momente A1.1, Lektion 1–10, 6 per lesson),
 * as on the printed sheet. In the exam each student gets cards like these: one asks, the other
 * answers in a full sentence and asks back ("Und du?"). In the app you draw one and practise it
 * with Gemini, which gets a ready prompt: its role, what to check, and the feedback to give.
 * Shared by the server and the browser; no secrets, no network.
 */
import type { UiLang } from '../types';

export interface SpeakingCard {
  id: string; // "4.1": Lektion 4, card 1
  lesson: number;
  question: string; // German, as printed
  hint: string; // the "Hilfe" line: an answer to start from
}

/** The lessons' names and the colours of their cards on the sheet. */
export const SPEAKING_LESSONS: Record<number, { title: string; color: string }> = {
  1: { title: 'Hallo!', color: '#d64541' },
  2: { title: 'Beruf und Wohnort', color: '#e07b1f' },
  3: { title: 'Familie und Sprachen', color: '#c9a21d' },
  4: { title: 'Möbel und Preise', color: '#4c9f38' },
  5: { title: 'Dinge und Farben', color: '#1d8a7c' },
  6: { title: 'Im Büro', color: '#2f6fd1' },
  7: { title: 'Freizeit und Hobbys', color: '#6b47c2' },
  8: { title: 'Uhrzeit und Termine', color: '#b04aa6' },
  9: { title: 'Essen und Trinken', color: '#c23a2e' },
  10: { title: 'Reisen und Verkehr', color: '#253c63' },
};

const CARDS: [string, string][][] = [
  [ // 1 · Hallo!
    ['Wie heißt du?', 'Ich heiße …'],
    ['Woher kommst du?', 'Ich komme aus …'],
    ['Wie geht es dir?', 'Danke, gut. / Es geht. Und dir?'],
    ['Wie schreibt man deinen Namen?', 'A – B – D – U …'],
    ['Woher kommt deine Lehrerin / dein Lehrer?', 'Sie / Er kommt aus …'],
    ['Wie sagt man auf Deutsch „Xayr“?', 'Tschüs! / Auf Wiedersehen!'],
  ],
  [ // 2 · Beruf und Wohnort
    ['Was bist du von Beruf?', 'Ich bin … / Ich bin Student/in.'],
    ['Wo wohnst du?', 'Ich wohne in …'],
    ['Wie alt bist du?', 'Ich bin … Jahre alt.'],
    ['Bist du verheiratet?', 'Ja, ich bin … / Nein, ich bin ledig.'],
    ['Wie ist deine Telefonnummer?', 'Meine Nummer ist null – neun …'],
    ['Wo arbeitest du?', 'Ich arbeite bei … / als …'],
  ],
  [ // 3 · Familie und Sprachen
    ['Hast du Geschwister?', 'Ja, ich habe … / Nein, ich habe keine Geschwister.'],
    ['Wie heißt deine Mutter?', 'Meine Mutter heißt …'],
    ['Welche Sprachen sprichst du?', 'Ich spreche … und ein bisschen …'],
    ['Sprichst du gut Englisch?', 'Ja, sehr gut. / Nein, nicht so gut.'],
    ['Wo wohnt deine Familie?', 'Meine Familie wohnt in …'],
    ['Wie alt ist dein Vater?', 'Er ist … Jahre alt.'],
  ],
  [ // 4 · Möbel und Preise
    ['Wie findest du dein Zimmer?', 'Ich finde es schön / klein / praktisch.'],
    ['Was kostet ein Handy?', 'Ein Handy kostet ungefähr … Euro.'],
    ['Welche Möbel hast du im Zimmer?', 'Ich habe einen Tisch, ein Bett, …'],
    ['Wie findest du das Sofa (im Kursraum / auf dem Bild)?', 'Ich finde es … / Das finde ich auch.'],
    ['Wie viel kostet ein Kaffee in Taschkent?', 'Ein Kaffee kostet … Sum.'],
    ['Ist dein Bett groß oder klein?', 'Es ist …'],
  ],
  [ // 5 · Dinge und Farben
    ['Was ist das? (Zeig auf ein Ding.)', 'Das ist ein / eine … / Das ist kein …'],
    ['Welche Farbe hat deine Tasche?', 'Sie ist …'],
    ['Wie heißt „ruchka“ auf Deutsch?', 'Das heißt … / Das weiß ich nicht.'],
    ['Woraus ist dein Tisch?', 'Er ist aus Holz / Glas / Metall …'],
    ['Wie ist deine E-Mail-Adresse?', 'Meine E-Mail-Adresse ist …'],
    ['Was ist deine Lieblingsfarbe?', 'Meine Lieblingsfarbe ist …'],
  ],
  [ // 6 · Im Büro
    ['Hast du einen Computer?', 'Ja, ich habe einen … / Nein, ich habe keinen …'],
    ['Was brauchst du für den Deutschkurs?', 'Ich brauche einen Kuli, ein Heft, …'],
    ['Hast du heute einen Termin?', 'Ja, ich habe … / Nein, ich habe keinen Termin.'],
    ['Wie meldest du dich am Telefon?', 'Hallo, hier ist …'],
    ['Wie viele Handys hat deine Familie?', 'Wir haben … Handys.'],
    ['Was hast du in der Tasche?', 'Ich habe einen / ein / eine … dabei.'],
  ],
  [ // 7 · Freizeit und Hobbys
    ['Was sind deine Hobbys?', 'Meine Hobbys sind … und …'],
    ['Kannst du gut kochen?', 'Ja, ich kann super kochen. / Nein, nicht so gut.'],
    ['Wie oft machst du Sport?', 'Ich mache immer / oft / manchmal / nie Sport.'],
    ['Was machst du gern in deiner Freizeit?', 'Ich … gern. Das macht Spaß.'],
    ['Kannst du schwimmen oder Ski fahren?', 'Ich kann … , aber ich kann nicht …'],
    ['Mach deinem Partner ein Kompliment!', 'Du kannst wirklich toll …! – Oh, danke!'],
  ],
  [ // 8 · Uhrzeit und Termine
    ['Wie spät ist es jetzt?', 'Es ist … / Es ist Viertel nach …'],
    ['Wann hast du am Montag Zeit?', 'Am Montag habe ich um … Uhr Zeit.'],
    ['Hast du am Samstag Zeit?', 'Ja, gern! / Tut mir leid, am Samstag kann ich nicht.'],
    ['Gehen wir heute Abend ins Kino?', 'Gute Idee! / Leider habe ich keine Zeit.'],
    ['Was machst du am Wochenende?', 'Am Wochenende … / Das weiß ich noch nicht.'],
    ['Wann beginnt der Deutschkurs?', 'Er beginnt um … Uhr.'],
  ],
  [ // 9 · Essen und Trinken
    ['Was isst du gern zum Frühstück?', 'Zum Frühstück esse ich gern …'],
    ['Was ist dein Lieblingsessen?', 'Mein Lieblingsessen ist …'],
    ['Magst du Fisch?', 'Ja, sehr. / Nein, ich mag keinen Fisch.'],
    ['Was trinkst du nicht gern?', '… trinke ich nicht gern.'],
    ['Du bist im Café. Was möchtest du?', 'Ich möchte einen / ein / eine … , bitte.'],
    ['Was isst du nie?', 'Ich esse nie …'],
  ],
  [ // 10 · Reisen und Verkehr
    ['Wie kommst du zum Kurs?', 'Mit dem Bus / mit der U-Bahn / zu Fuß …'],
    ['Wann fährt dein Bus / deine U-Bahn ab?', 'Mein Bus fährt um … ab.'],
    ['Wer holt dich nach dem Kurs ab?', 'Mein … holt mich ab. / Niemand.'],
    ['Wann rufst du deine Mutter an?', 'Ich rufe sie am … an.'],
    ['Wann kaufst du ein?', 'Ich kaufe am … ein.'],
    ['Was hast du auf Reisen immer im Gepäck?', 'Ich habe immer … im Koffer / Rucksack.'],
  ],
];

/** All 60 cards, 1.1 to 10.6. */
export const SPEAKING_CARDS: SpeakingCard[] = CARDS.flatMap((cards, i) =>
  cards.map(([question, hint], j) => ({ id: `${i + 1}.${j + 1}`, lesson: i + 1, question, hint })),
);

export const speakingCard = (id: string) => SPEAKING_CARDS.find((c) => c.id === id) ?? null;

/** A random card, never the one you just had. */
export function drawTopic(previousId: string | null, random: () => number = Math.random): SpeakingCard {
  const pool = SPEAKING_CARDS.filter((c) => c.id !== previousId);
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/**
 * The message the student pastes into Gemini: the topic first, then who Gemini is (their A1
 * exam partner and teacher), short feedback after EVERY answer (mistake → correction, why, the
 * corrected answer, a follow-up question), and a full summary when they say "finish" ("Fertig",
 * "tugadi"). Explanations in the student's interface language; the German stays German.
 */
export function geminiPrompt(card: SpeakingCard, lang: UiLang): string {
  const lesson = `Momente A1.1 · Lektion ${card.lesson} · ${SPEAKING_LESSONS[card.lesson].title}`;
  // In quotes, unless it has its own („ruchka“): quotes inside quotes read badly
  const topic = card.question.includes('„') ? card.question : `„${card.question}“`;
  if (lang === 'uz') {
    return [
      `🎤 GAPIRISH MAVZUSI: ${topic}`,
      `(${lesson} · kartochka ${card.id})`,
      '',
      'Siz mening nemis tili A1 gapirish imtihoni boʻyicha sherigim va oʻqituvchimsiz. Men oʻzbekman, A1 darajadaman.',
      '',
      'Qanday ishlaymiz:',
      '1. Mavzu savolini menga nemischa bering.',
      '2. Men nemischa javob beraman (ovoz bilan). HAR BIR javobimdan keyin darhol:',
      '   ❌ men aytgan → ✅ toʻgʻrisi — nega (1 qator, oʻzbekcha)',
      '   ✍️ javobimning toʻgʻrilangan varianti',
      '   ➡️ keyin mavzu boʻyicha bitta oddiy qoʻshimcha savol bering.',
      '3. Men „finish“ (yoki „Fertig“, „tugadi“) deganimda — yakuniy xulosa:',
      '   📊 Baho 1–10 va imtihondan oʻtish ehtimoli',
      '   ❌ Barcha xatolarim, turi boʻyicha (feʼl, soʻz tartibi, artikl, kelishik)',
      '   🌟 Shu mavzu boʻyicha namuna javob (A1, 4–5 gap)',
      '   💡 Keyingi safar uchun 2 ta maslahat',
      '',
      'Tekshiring: feʼl shakllari, soʻz tartibi (feʼl 2-oʻrinda), artikl va kelishik, toʻliq gaplar, mavzuga moslik.',
      'Faqat oddiy A1 nemis tilidan foydalaning. Hozir savolni berib boshlang.',
    ].join('\n');
  }
  return [
    `🎤 SPEAKING TOPIC: ${topic}`,
    `(${lesson} · card ${card.id})`,
    '',
    'You are my partner and teacher for the German A1 speaking exam. I am learning German at A1 level.',
    '',
    'How it works:',
    '1. Ask me the topic question in German.',
    '2. I answer in German (by voice). After EVERY answer, right away:',
    '   ❌ what I said → ✅ the correct version — why (one line, in English)',
    '   ✍️ my answer, corrected',
    '   ➡️ then ask me one simple follow-up question on the topic.',
    '3. When I say “finish” (or “Fertig”, “stop”) — a final summary:',
    '   📊 Score 1–10 and how likely I would pass the exam',
    '   ❌ All my mistakes, grouped by type (verbs, word order, articles, cases)',
    '   🌟 A model answer for this topic (A1, 4–5 sentences)',
    '   💡 2 tips for next time',
    '',
    'Check: verb forms, word order (verb in second position), articles and cases, full sentences, staying on the topic.',
    'Use simple A1 German only. Start now by asking the question.',
  ].join('\n');
}

/**
 * Gemini with the message already in its text box: Gemini's Guided Learning page takes it from
 * `?query=` (its normal chat page ignores `?q=`). Not documented by Google, so the app also
 * copies the message: if the box is ever empty, the student pastes it.
 */
export const geminiUrl = (prompt: string) => `https://gemini.google.com/guided-learning?query=${encodeURIComponent(prompt)}`;
