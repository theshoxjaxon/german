/**
 * Mock tests for the German course, level A1.1 (Momente A1, Lektion 1–12), in the format of the
 * class's own tests:
 *   Wiederholungstest Modul 1–4   Teil A Grammatik (25 × a–d) + Teil B Lesen (5 × richtig/falsch) = 30
 *   Abschlusstest                 Grammatik, Lesen, Schreiben, Sprechen, 25 each; 18 in every part to pass
 * Written for this app with words from the lessons (not the class's paper tests). Server-only:
 * this file has the answer key; the browser gets each test through publicTest().
 */
import type { ChoiceItem, SpeakingItem, Test, TrueFalseItem } from '../../tests/types';

const TEIL_A = {
  title: 'Teil A – Grammatik',
  instruction: 'Markieren Sie die richtige Lösung.',
  instructionUz: 'Toʻgʻri javobni belgilang.',
};
const TEIL_B = {
  title: 'Teil B – Lesen',
  instruction: 'Lesen Sie den Text. Sind die Aussagen richtig oder falsch? Kreuzen Sie an.',
  instructionUz: 'Matnni oʻqing. Gaplar toʻgʻrimi yoki notoʻgʻri? Belgilang.',
};

/** A dialogue question: ■ prompt / • reply, four options, the right one's index. */
const mc = (id: string, prompt: string, reply: string, options: [string, string, string, string], answer: 0 | 1 | 2 | 3): ChoiceItem =>
  ({ id, type: 'choice', prompt, ...(reply ? { reply } : {}), options, answer });
const tf = (id: string, prompt: string, answer: boolean): TrueFalseItem => ({ id, type: 'truefalse', prompt, answer });

/** A Wiederholungstest: Teil A (25 questions, 25 points) and Teil B (a text, 5 statements, 5 points). */
function unit(n: number, lessons: string, topics: string, themes: string, grammar: ChoiceItem[], text: { title: string; body: string }, statements: TrueFalseItem[]): Test {
  return {
    id: `a11-modul-${n}`,
    course: 'german',
    level: 'A1.1',
    kind: 'unit',
    title: `Wiederholungstest Modul ${n}`,
    subtitle: `Lektion ${lessons}`,
    minutes: 30,
    topics,
    themes,
    sections: [
      { id: 'grammatik', points: 25, tasks: [{ id: `m${n}-a`, ...TEIL_A, items: grammar }] },
      { id: 'lesen', points: 5, tasks: [{ id: `m${n}-b`, ...TEIL_B, texts: [{ kind: 'email', ...text }], items: statements }] },
    ],
  };
}

/* ============================== Modul 1: Lektion 1–3 ============================== */

const MODUL_1 = unit(1, '1–3', 'Greetings, people, countries and languages, numbers, family, jobs', 'Begrüßung, Personen, Länder und Sprachen, Zahlen, Familie, Berufe', [
  mc('m1-1', '___ heißt du?', 'Ich heiße Aziz.', ['Wie', 'Wo', 'Woher', 'Was'], 0),
  mc('m1-2', 'Woher ___ Sie?', 'Ich komme aus Usbekistan.', ['kommt', 'komme', 'kommen', 'kommst'], 2),
  mc('m1-3', 'Wo wohnst du?', 'Ich ___ in Taschkent.', ['wohnst', 'wohne', 'wohnt', 'wohnen'], 1),
  mc('m1-4', '___ du Englisch?', 'Ja, ein bisschen.', ['Sprichst', 'Sprechst', 'Spricht', 'Sprechen'], 0),
  mc('m1-5', 'Was ___ Sie von Beruf?', 'Ich bin Lehrerin.', ['ist', 'bist', 'sind', 'seid'], 2),
  mc('m1-6', 'Wie alt ___ deine Schwester?', 'Sie ist 15.', ['bin', 'bist', 'ist', 'sind'], 2),
  mc('m1-7', '___ ihr aus Samarkand?', 'Ja, wir sind aus Samarkand.', ['Seid', 'Sind', 'Ist', 'Bist'], 0),
  mc('m1-8', 'Hast du Geschwister?', 'Ja, ich ___ einen Bruder.', ['hast', 'hat', 'habe', 'haben'], 2),
  mc('m1-9', 'Wie heißt ___ Mutter?', 'Sie heißt Nodira.', ['dein', 'deine', 'deinen', 'du'], 1),
  mc('m1-10', 'Ist das ___ Vater, Frau Weber?', 'Ja, das ist mein Vater.', ['Ihr', 'Ihre', 'dein', 'deine'], 0),
  mc('m1-11', 'Wer ist das?', 'Das ist ___ Bruder Timur.', ['meine', 'mein', 'meinen', 'mich'], 1),
  mc('m1-12', '___ wohnt Anna?', 'In Berlin.', ['Woher', 'Wer', 'Wo', 'Wie'], 2),
  mc('m1-13', 'Sprechen Sie Deutsch?', '___, ich spreche Deutsch und Russisch.', ['Nein', 'Ja', 'Doch', 'Nicht'], 1),
  mc('m1-14', 'Welcher Satz ist richtig?', '', ['Ich heute arbeite.', 'Heute arbeite ich.', 'Heute ich arbeite.', 'Arbeite heute ich.'], 1),
  mc('m1-15', 'Wie geht es Ihnen?', '___, danke. Und Ihnen?', ['Gut', 'Alt', 'Groß', 'Viel'], 0),
  mc('m1-16', 'Was ist Sardor von Beruf?', 'Er ___ Arzt.', ['bin', 'sind', 'ist', 'seid'], 2),
  mc('m1-17', 'Woher kommt ihr?', 'Wir ___ aus Usbekistan.', ['kommt', 'kommen', 'komme', 'kommst'], 1),
  mc('m1-18', '___ ist deine Telefonnummer?', '0176 34 56 78.', ['Was', 'Wie', 'Wo', 'Wer'], 1),
  mc('m1-19', 'Wie alt bist du? (21)', 'Ich bin ___ Jahre alt.', ['einundzwanzig', 'zwanzigeins', 'zwölf', 'zweiundzwanzig'], 0),
  mc('m1-20', 'Sind das deine Eltern?', 'Ja, das sind ___ Eltern.', ['mein', 'meine', 'meinen', 'meiner'], 1),
  mc('m1-21', 'Was machst du?', 'Ich ___ Studentin.', ['bin', 'habe', 'heiße', 'komme'], 0),
  mc('m1-22', '___ Sie verheiratet?', 'Nein, ich bin ledig.', ['Haben', 'Bist', 'Sind', 'Ist'], 2),
  mc('m1-23', 'Wie viele Kinder hat Frau Novak?', 'Sie hat ___ Kinder: einen Sohn und eine Tochter.', ['zwei', 'drei', 'ein', 'eins'], 0),
  mc('m1-24', '___ Sprachen sprichst du?', 'Usbekisch und Russisch.', ['Was', 'Welche', 'Wie', 'Wo'], 1),
  mc('m1-25', 'Kommst du aus Russland?', 'Nein, ich komme ___ Usbekistan.', ['in', 'aus', 'von', 'nach'], 1),
], {
  title: 'Ich und meine Familie',
  body: 'Hallo, ich heiße Kamola und bin 19 Jahre alt. Ich komme aus Buchara, aber jetzt wohne ich in Taschkent. Ich bin Studentin und lerne Deutsch.\n\nMein Vater heißt Rustam. Er ist Ingenieur. Meine Mutter ist Ärztin. Ich habe zwei Brüder, aber keine Schwester. Mein Bruder Bobur ist 23 und wohnt in Samarkand.\n\nIch spreche Usbekisch, Russisch und ein bisschen Englisch.',
}, [
  tf('m1-26', 'Kamola wohnt jetzt in Buchara.', false),
  tf('m1-27', 'Kamola ist Studentin.', true),
  tf('m1-28', 'Kamolas Mutter ist Lehrerin.', false),
  tf('m1-29', 'Kamola hat eine Schwester.', false),
  tf('m1-30', 'Bobur wohnt in Samarkand.', true),
]);

/* ============================== Modul 2: Lektion 4–6 ============================== */

const MODUL_2 = unit(2, '4–6', 'Home and furniture, prices, things and colours, the office, appointments', 'Wohnung, Möbel, Preise, Dinge, Farben, Büro, Termine', [
  mc('m2-1', 'Was ist das?', 'Das ist ___ Stuhl.', ['ein', 'eine', 'einen', 'keine'], 0),
  mc('m2-2', 'Brauchst du einen Tisch?', 'Nein, ich habe schon ___ Tisch.', ['ein', 'eine', 'einen', 'keinen'], 2),
  mc('m2-3', 'Ist das eine Lampe?', 'Nein, das ist ___ Lampe. Das ist ein Spiegel.', ['kein', 'keine', 'keinen', 'nicht'], 1),
  mc('m2-4', 'Wie findest du das Sofa?', '___ ist sehr bequem.', ['Er', 'Sie', 'Es', 'Ihr'], 2),
  mc('m2-5', 'Wie viel ___ der Schrank?', '199 Euro.', ['kostet', 'kosten', 'kostest', 'koste'], 0),
  mc('m2-6', 'Was kosten die Stühle?', '___ kosten 40 Euro.', ['Er', 'Es', 'Sie', 'Wir'], 2),
  mc('m2-7', 'Ich brauche zwei ___.', 'Die Lampen hier sind günstig.', ['Lampe', 'Lampen', 'Lampes', 'Lampens'], 1),
  mc('m2-8', 'Hast du viele Bücher?', 'Ja, ich habe 200 ___.', ['Buch', 'Buchs', 'Bücher', 'Büchern'], 2),
  mc('m2-9', 'Kaufst du das Bett?', 'Nein, ich finde ___ zu teuer.', ['es', 'er', 'sie', 'du'], 0),
  mc('m2-10', 'Wie findest du den Tisch?', 'Ich finde ___ Tisch modern.', ['der', 'den', 'die', 'das'], 1),
  mc('m2-11', 'Hast du ___ Handy?', 'Ja, hier, bitte.', ['ein', 'einen', 'eine', 'einer'], 0),
  mc('m2-12', 'Haben Sie einen Stift?', 'Nein, ich habe ___ Stift.', ['kein', 'keine', 'keinen', 'nicht'], 2),
  mc('m2-13', 'Welche Farbe hat das Auto?', 'Das Auto ist ___.', ['rot', 'Rot', 'rote', 'roten'], 0),
  mc('m2-14', 'Frau Roth ist nicht da.', '___ Sie bitte später zurück.', ['Rufen', 'Ruft', 'Rufst', 'Ruf'], 0),
  mc('m2-15', '___ Sie bitte das Formular.', 'Ja, gern.', ['Lesen', 'Liest', 'Lest', 'Lese'], 0),
  mc('m2-16', 'Wann ist der Termin?', '___ Montag um 10 Uhr.', ['Am', 'Um', 'Im', 'In'], 0),
  mc('m2-17', 'Um wie viel Uhr kommen Sie?', '___ 15 Uhr.', ['Am', 'Um', 'Im', 'Von'], 1),
  mc('m2-18', 'Wann arbeitest du?', 'Ich arbeite ___ 8 ___ 17 Uhr.', ['von … bis', 'am … um', 'um … am', 'bis … von'], 0),
  mc('m2-19', 'Wie spät ist es? (14:30)', 'Es ist vierzehn Uhr ___.', ['dreißig', 'dreizehn', 'drei', 'dreiundzwanzig'], 0),
  mc('m2-20', 'Was macht Herr Klein?', 'Er ___ gerade.', ['telefoniert', 'telefonierst', 'telefonieren', 'telefoniere'], 0),
  mc('m2-21', '___ du mir eine Nachricht?', 'Ja, gleich.', ['Schreibst', 'Schreibt', 'Schreibe', 'Schreiben'], 0),
  mc('m2-22', 'Ist der Drucker neu?', 'Nein, er ist ___.', ['alt', 'groß', 'teuer', 'schön'], 0),
  mc('m2-23', 'Wo ist die Tasche?', '___ ist hier.', ['Er', 'Sie', 'Es', 'Ihr'], 1),
  mc('m2-24', 'Wie heißt das auf Deutsch?', 'Das ist ___ Geldbeutel.', ['ein', 'eine', 'einen', 'keine'], 0),
  mc('m2-25', 'Ist das Zimmer groß?', 'Nein, es ist sehr ___.', ['klein', 'teuer', 'modern', 'neu'], 0),
], {
  title: 'Mein neues Büro',
  body: 'Liebe Sara,\n\nich arbeite jetzt bei einer Firma in Köln. Mein Büro ist klein, aber hell und modern. Ich habe einen Schreibtisch, einen Computer und ein Telefon. Einen Drucker habe ich nicht, der Drucker ist im Büro von Frau Weber.\n\nIch arbeite von Montag bis Freitag, von 9 bis 17 Uhr. Am Mittwoch habe ich um 14 Uhr immer einen Termin mit meinem Chef.\n\nViele Grüße\nAziz',
}, [
  tf('m2-26', 'Aziz arbeitet in Köln.', true),
  tf('m2-27', 'Das Büro ist groß.', false),
  tf('m2-28', 'Aziz hat einen Drucker.', false),
  tf('m2-29', 'Aziz arbeitet am Samstag.', false),
  tf('m2-30', 'Am Mittwoch hat Aziz einen Termin.', true),
]);

/* ============================== Modul 3: Lektion 7–9 ============================== */

const MODUL_3 = unit(3, '7–9', 'Hobbies, free time, making plans, food and eating', 'Hobbys, Freizeit, Verabredungen, Lebensmittel, Essen', [
  mc('m3-1', '___ ihr gut schwimmen?', 'Ja, sehr gut.', ['Kann', 'Kannst', 'Könnt', 'Können'], 2),
  mc('m3-2', 'Spielt Sara Tennis?', 'Ja, sie ___ gut Tennis spielen.', ['kann', 'kannst', 'können', 'könnt'], 0),
  mc('m3-3', 'Was kann Timur gut?', 'Timur kann ___.', ['kocht sehr gut', 'sehr gut kochen', 'kochen sehr gut', 'sehr gut kocht'], 1),
  mc('m3-4', 'Was macht Lisa am Abend?', 'Sie ___ ein Buch.', ['lese', 'lest', 'liest', 'lesen'], 2),
  mc('m3-5', '___ du am Wochenende nach Buchara?', 'Ja, mit dem Zug.', ['Fahrst', 'Fährst', 'Fährt', 'Fahren'], 1),
  mc('m3-6', 'Was isst du zum Frühstück?', 'Ich ___ Brot mit Käse.', ['isst', 'esst', 'esse', 'essen'], 2),
  mc('m3-7', 'Was ___ Paul?', 'Eine Pizza mit Salat.', ['nimmt', 'nehmt', 'nimmst', 'nehmen'], 0),
  mc('m3-8', 'Wann ___ du morgen auf?', 'Um sechs Uhr.', ['stehst', 'stehe', 'steht', 'stehen'], 0),
  mc('m3-9', 'Wann fängt der Kurs an?', 'Der Kurs ___ um neun Uhr ___.', ['fängt … an', 'an … fängt', 'fangt … an', 'fängt … auf'], 0),
  mc('m3-10', 'Was möchten Sie trinken?', 'Ich ___ einen Tee, bitte.', ['möchte', 'möchtest', 'möchten', 'mögt'], 0),
  mc('m3-11', '___ du Fisch?', 'Nein, ich mag keinen Fisch.', ['Mag', 'Magst', 'Mögt', 'Mögen'], 1),
  mc('m3-12', 'Was ___ ihr gern?', 'Wir essen gern Plov.', ['esst', 'essen', 'isst', 'esse'], 0),
  mc('m3-13', 'Trinkst du gern Kaffee?', 'Ja, aber ich trinke ___ Tee.', ['lieber', 'gern', 'gut', 'viel'], 0),
  mc('m3-14', 'Wann gehen wir ins Kino?', '___ Freitag.', ['Am', 'Um', 'Im', 'In'], 0),
  mc('m3-15', 'Wann beginnt das Konzert?', '___ halb acht.', ['Am', 'Um', 'Im', 'Von'], 1),
  mc('m3-16', 'Wie spät ist es? (19:15)', 'Es ist Viertel ___ sieben.', ['nach', 'vor', 'halb', 'um'], 0),
  mc('m3-17', 'Wie spät ist es? (6:30)', 'Es ist ___.', ['halb sieben', 'halb sechs', 'sechs halb', 'sieben halb'], 0),
  mc('m3-18', 'Wie spät ist es? (10:45)', 'Es ist Viertel ___ elf.', ['nach', 'vor', 'um', 'halb'], 1),
  mc('m3-19', 'Wann kommt Malika?', 'Das ___ ich nicht.', ['weiß', 'wisst', 'wissen', 'weißt'], 0),
  mc('m3-20', '___ ihr, wo das Café ist?', 'Ja, in der Bahnhofstraße.', ['Weißt', 'Wisst', 'Wissen', 'Weiß'], 1),
  mc('m3-21', 'Was machst du am Sonntag?', 'Am Sonntag ___.', ['ich schlafe lange', 'schlafe ich lange', 'lange ich schlafe', 'schlafe lange ich'], 1),
  mc('m3-22', 'Wie oft gehst du ins Kino?', '___. Nur einmal im Monat.', ['Immer', 'Oft', 'Nicht oft', 'Jeden Tag'], 2),
  mc('m3-23', 'der Apfel + der Kuchen =', '___ Apfelkuchen', ['der', 'die', 'das', 'den'], 0),
  mc('m3-24', 'Kommst du mit ins Schwimmbad?', 'Tut mir leid, ich ___ keine Zeit.', ['habe', 'hast', 'hat', 'haben'], 0),
  mc('m3-25', 'Was ___ du in deiner Freizeit?', 'Ich treffe Freunde und spiele Fußball.', ['machst', 'macht', 'mache', 'machen'], 0),
], {
  title: 'Mein Wochenende',
  body: 'Hallo, ich bin Sevara und wohne in Taschkent. In meiner Freizeit tanze ich gern und ich lese viel. Kochen kann ich leider nicht gut.\n\nAm Samstag stehe ich spät auf, so um zehn Uhr. Am Nachmittag treffe ich meine Freundin Dilnoza. Wir gehen zusammen ins Café. Dilnoza trinkt immer Tee, ich trinke lieber Kaffee und esse ein Stück Kuchen.\n\nAm Sonntag fahre ich mit meinem Bruder Rad.',
}, [
  tf('m3-26', 'Sevara kann gut kochen.', false),
  tf('m3-27', 'Am Samstag steht Sevara um zehn Uhr auf.', true),
  tf('m3-28', 'Sevara trifft Dilnoza am Vormittag.', false),
  tf('m3-29', 'Sevara trinkt lieber Kaffee.', true),
  tf('m3-30', 'Am Sonntag fährt Sevara Rad.', true),
]);

/* ============================== Modul 4: Lektion 10–12 ============================== */

const MODUL_4 = unit(4, '10–12', 'Travel and transport, the weekend, festivals, seasons and the weather', 'Reisen, Verkehr, Wochenende, Feste, Jahreszeiten, Wetter', [
  mc('m4-1', 'Was hast du gestern gemacht?', 'Ich ___ Fußball gespielt.', ['habe', 'bin', 'hat', 'ist'], 0),
  mc('m4-2', 'Wann seid ihr nach Hause gekommen?', 'Wir ___ um zehn Uhr gekommen.', ['haben', 'sind', 'seid', 'hat'], 1),
  mc('m4-3', 'Hast du schon gegessen?', 'Ja, ich habe schon ___.', ['gegessen', 'geessen', 'gegesst', 'essen'], 0),
  mc('m4-4', 'Wann ist der Zug angekommen?', 'Er ist um 8 Uhr ___.', ['angekommt', 'angekommen', 'ankommen', 'geankommen'], 1),
  mc('m4-5', 'Was hat Anna am Wochenende gemacht?', 'Sie hat ihre Oma ___.', ['besucht', 'gebesucht', 'besuchen', 'besuchte'], 0),
  mc('m4-6', 'Wo ___ du gestern?', 'Ich war zu Hause.', ['warst', 'war', 'wart', 'waren'], 0),
  mc('m4-7', '___ ihr am Montag Zeit?', 'Nein, wir hatten keine Zeit.', ['Hattet', 'Hattest', 'Hatte', 'Hatten'], 0),
  mc('m4-8', 'Ich bin krank.', 'Du ___ zum Arzt gehen.', ['musst', 'muss', 'müsst', 'müssen'], 0),
  mc('m4-9', 'Darf man hier rauchen?', 'Nein, hier ___ man nicht rauchen.', ['darf', 'darfst', 'dürfen', 'dürft'], 0),
  mc('m4-10', 'Jonas, ___ bitte pünktlich!', 'Ja, okay.', ['komm', 'kommst', 'kommt', 'kommen'], 0),
  mc('m4-11', 'Kinder, ___ bitte leise!', 'Ja, Mama.', ['sei', 'seid', 'sind', 'bist'], 1),
  mc('m4-12', '___ mich bitte morgen an!', 'Gut, ich rufe dich an.', ['Ruf', 'Rufst', 'Ruft', 'Rufen'], 0),
  mc('m4-13', 'Wann hast du Geburtstag? (3.5.)', 'Am ___ Mai.', ['dritte', 'dritten', 'drei', 'dritter'], 1),
  mc('m4-14', 'Der Wievielte ist heute? (1.10.)', 'Heute ist der ___ Oktober.', ['erste', 'ersten', 'eins', 'einste'], 0),
  mc('m4-15', 'Wohin fährst du im Urlaub?', 'Ich fahre ___ Berlin.', ['nach', 'in', 'zu', 'zum'], 0),
  mc('m4-16', 'Wohin gehst du?', 'Ich gehe ___ Bäckerei.', ['zum', 'zur', 'nach', 'in'], 1),
  mc('m4-17', 'Wohin geht ihr?', 'Wir gehen ___ Arzt.', ['zur', 'zum', 'nach', 'in'], 1),
  mc('m4-18', 'Kennst du Paul?', 'Ja, ich kenne ___ gut.', ['er', 'ihn', 'ihm', 'sein'], 1),
  mc('m4-19', 'Rufst du mich morgen an?', 'Ja, ich rufe ___ an.', ['du', 'dich', 'dir', 'mich'], 1),
  mc('m4-20', 'Wann fährt der Bus ab?', 'Der Bus ___ um 7:15 Uhr ___.', ['fährt … ab', 'abfährt … –', 'fahrt … ab', 'fährt … an'], 0),
  mc('m4-21', 'Welcher Monat kommt nach Mai?', '___.', ['April', 'Juni', 'Juli', 'März'], 1),
  mc('m4-22', 'Wie ist das Wetter?', 'Es ___ und es ist kalt.', ['regnet', 'regnen', 'regnest', 'Regen'], 0),
  mc('m4-23', 'Wann ist die Party?', '___ Samstag um 20 Uhr.', ['Am', 'Im', 'Um', 'In'], 0),
  mc('m4-24', 'Wann warst du in Deutschland?', '___ Sommer.', ['Im', 'Am', 'Um', 'In'], 0),
  mc('m4-25', 'Kommst du zu meiner Party?', '___, ich kann leider nicht.', ['Danke', 'Tut mir leid', 'Gern', 'Prima'], 1),
], {
  title: 'Ein Wochenende in Samarkand',
  body: 'Hallo Jonas,\n\nwie war dein Wochenende? Ich war mit meiner Familie in Samarkand. Wir sind am Freitagabend mit dem Zug gefahren. Die Fahrt hat zwei Stunden gedauert.\n\nAm Samstag haben wir die Altstadt besucht und viele Fotos gemacht. Das Wetter war super, aber es war sehr heiß. Am Sonntag hat es geregnet. Wir sind im Hotel geblieben und haben Karten gespielt.\n\nViele Grüße\nAziza',
}, [
  tf('m4-26', 'Aziza war allein in Samarkand.', false),
  tf('m4-27', 'Die Familie ist mit dem Zug gefahren.', true),
  tf('m4-28', 'Die Fahrt hat zwei Stunden gedauert.', true),
  tf('m4-29', 'Am Samstag war das Wetter schlecht.', false),
  tf('m4-30', 'Am Sonntag sind sie im Hotel geblieben.', true),
]);

/* ============================== Abschlusstest: Lektion 1–12 ============================== */

const PASS = 18;
/** One question of the "partner" (read aloud by the phone), and the student's answer. */
const partner = (n: number, question: string, model: string): SpeakingItem => ({
  id: `f-p2-${n}`, type: 'speaking', kind: 'partner', max: 2,
  prompt: question,
  promptUz: 'Sherigingiz savol beradi. Tinglang va javob bering.',
  cards: [],
  audio: [{ who: 'b', text: question }],
  model,
});

const FINAL: Test = {
  id: 'a11-abschlusstest',
  course: 'german',
  level: 'A1.1',
  kind: 'final',
  title: 'Abschlusstest',
  subtitle: 'Lektion 1–12',
  minutes: 90,
  topics: 'Everything from Lektion 1–12: grammar, reading, writing and speaking, 25 points each; you need 18 in every part',
  themes: 'Alle Themen aus Lektion 1–12',
  sections: [
    {
      id: 'grammatik', points: 25, pass: PASS,
      tasks: [{
        id: 'f-a', ...TEIL_A, title: 'Grammatik',
        items: [
          mc('f-g-1', 'Woher ___ du?', 'Aus Usbekistan.', ['kommst', 'kommt', 'komme', 'kommen'], 0),
          mc('f-g-2', 'Was sind Sie von Beruf?', 'Ich ___ Krankenschwester.', ['bin', 'ist', 'sind', 'bist'], 0),
          mc('f-g-3', 'Hast du Geschwister?', 'Ja, ich habe ___ Schwester.', ['ein', 'eine', 'einen', 'keinen'], 1),
          mc('f-g-4', 'Brauchst du einen Stuhl?', 'Nein, danke. Ich brauche ___ Stuhl.', ['kein', 'keine', 'keinen', 'nicht'], 2),
          mc('f-g-5', 'Wie findest du die Lampe?', '___ ist schön.', ['Er', 'Sie', 'Es', 'Wir'], 1),
          mc('f-g-6', 'Ich habe einen Stuhl. Und du?', 'Ich habe zwei ___.', ['Stuhl', 'Stühle', 'Stuhls', 'Stühlen'], 1),
          mc('f-g-7', 'Wann ist der Termin?', '___ Dienstag ___ 9 Uhr.', ['Am … um', 'Um … am', 'Im … um', 'Am … im'], 0),
          mc('f-g-8', '___ du gut singen?', 'Nein, leider nicht.', ['Kannst', 'Kann', 'Könnt', 'Können'], 0),
          mc('f-g-9', 'Was macht Aziz?', 'Er ___ die Zeitung.', ['liest', 'lest', 'lese', 'lesen'], 0),
          mc('f-g-10', 'Wann stehst du auf?', 'Ich ___ um sieben Uhr ___.', ['stehe … auf', 'aufstehe … –', 'stehst … auf', 'stehe … an'], 0),
          mc('f-g-11', 'Was möchtest du?', 'Ich ___ einen Kaffee, bitte.', ['möchte', 'möchtest', 'möchten', 'mögen'], 0),
          mc('f-g-12', 'Magst du Schokolade?', 'Ja, ich ___ Schokolade sehr.', ['mag', 'magst', 'mögen', 'möchte'], 0),
          mc('f-g-13', 'Wie spät ist es? (8:30)', 'Es ist ___.', ['halb acht', 'halb neun', 'acht halb', 'neun halb'], 1),
          mc('f-g-14', 'Was hast du am Wochenende gemacht?', 'Ich ___ meine Freunde getroffen.', ['habe', 'bin', 'hat', 'war'], 0),
          mc('f-g-15', 'Wohin seid ihr gefahren?', 'Wir ___ nach Buchara gefahren.', ['haben', 'sind', 'seid', 'waren'], 1),
          mc('f-g-16', 'Wo warst du gestern?', 'Ich ___ krank.', ['war', 'hatte', 'bin', 'habe'], 0),
          mc('f-g-17', 'Hast du die Hausaufgaben ___?', 'Ja, schon gestern.', ['gemacht', 'machen', 'gemachen', 'macht'], 0),
          mc('f-g-18', 'Hier ist Rauchen verboten.', 'Hier ___ man nicht rauchen.', ['darf', 'muss', 'kann', 'möchte'], 0),
          mc('f-g-19', 'Ich habe Kopfschmerzen.', 'Dann ___ du zum Arzt gehen.', ['musst', 'darfst', 'möchtest', 'magst'], 0),
          mc('f-g-20', 'Marco, ___ bitte langsam!', 'Okay.', ['sprich', 'sprichst', 'sprecht', 'sprechen'], 0),
          mc('f-g-21', 'Wann hast du Geburtstag? (5.6.)', 'Am ___ Juni.', ['fünfte', 'fünften', 'fünf', 'fünfter'], 1),
          mc('f-g-22', 'Wohin gehst du jetzt?', '___ Supermarkt.', ['Zum', 'Zur', 'Nach', 'In'], 0),
          mc('f-g-23', 'Kennst du Frau Weber?', 'Ja, ich kenne ___ gut.', ['ihn', 'sie', 'ihr', 'er'], 1),
          mc('f-g-24', 'Welcher Satz ist richtig?', '', ['Am Montag ich arbeite bis 18 Uhr.', 'Am Montag arbeite ich bis 18 Uhr.', 'Ich am Montag arbeite bis 18 Uhr.', 'Arbeite am Montag ich bis 18 Uhr.'], 1),
          mc('f-g-25', 'Ich habe heute Geburtstag!', '___!', ['Alles Gute zum Geburtstag', 'Gute Besserung', 'Guten Appetit', 'Gute Reise'], 0),
        ],
      }],
    },
    {
      id: 'lesen', points: 25, pass: PASS,
      tasks: [
        {
          id: 'f-l1', title: 'Teil 1', instruction: 'Lesen Sie den Text und die Aufgaben. Richtig oder falsch?', instructionUz: 'Matn va topshiriqlarni oʻqing. Toʻgʻrimi yoki notoʻgʻri?',
          texts: [{
            kind: 'email',
            title: 'Termin am Montag',
            body: 'Liebe Frau Hoffmann,\n\nvielen Dank für Ihre E-Mail. Ich komme gern am Montag zu Ihnen ins Büro. Leider kann ich nicht um 9 Uhr kommen, denn mein Deutschkurs ist von 8 bis 11 Uhr. Geht es auch um 12 Uhr?\n\nIch habe in Taschkent fünf Jahre als Bürokauffrau gearbeitet. Ich spreche Usbekisch, Russisch, Englisch und ein bisschen Deutsch. Ich lerne seit sechs Monaten Deutsch.\n\nMit freundlichen Grüßen\nGulnora Saidova',
          }],
          items: [
            tf('f-l1-1', 'Gulnora möchte am Montag ins Büro kommen.', true),
            tf('f-l1-2', 'Gulnora hat am Montag um 9 Uhr Zeit.', false),
            tf('f-l1-3', 'Der Deutschkurs ist am Vormittag.', true),
            tf('f-l1-4', 'Gulnora hat in Taschkent als Lehrerin gearbeitet.', false),
            tf('f-l1-5', 'Gulnora lernt seit einem Jahr Deutsch.', false),
          ],
        },
        {
          id: 'f-l2', title: 'Teil 2', instruction: 'Lesen Sie die Aufgaben und die Texte. Welcher Text passt: a oder b?', instructionUz: 'Topshiriqlar va matnlarni oʻqing. Qaysi matn mos keladi: a yoki b?',
          items: [
            { id: 'f-l2-1', type: 'choice', prompt: 'Sie suchen eine kleine Wohnung in der Stadt.', options: ['1-Zimmer-Wohnung im Zentrum, 35 m², Küche, Bad, 450 Euro.', 'Großes Haus mit Garten, 5 Zimmer, 20 km von der Stadt, 1.500 Euro.'], answer: 0 },
            { id: 'f-l2-2', type: 'choice', prompt: 'Sie möchten Ihr altes Fahrrad verkaufen.', options: ['Fahrradladen Speiche: Neue Fahrräder ab 299 Euro!', 'Flohmarkt am Sonntag: Hier können Sie alles verkaufen. Ein Tisch kostet 10 Euro.'], answer: 1 },
            { id: 'f-l2-3', type: 'choice', prompt: 'Sie arbeiten am Tag und möchten am Abend Deutsch lernen.', options: ['Volkshochschule: Deutsch A1, Montag und Mittwoch 18:30–20:00 Uhr.', 'Sprachschule Lingua: Deutsch intensiv, Montag bis Freitag 9–13 Uhr.'], answer: 0 },
            { id: 'f-l2-4', type: 'choice', prompt: 'Ihr Kind ist krank. Es ist Sonntag.', options: ['Kinderarzt Dr. Weiß: Sprechzeiten Montag bis Freitag 8–13 Uhr.', 'Kinderärztlicher Notdienst: Samstag und Sonntag 9–21 Uhr, Tel. 116 117.'], answer: 1 },
            { id: 'f-l2-5', type: 'choice', prompt: 'Sie möchten mit 30 Freunden Geburtstag feiern.', options: ['Restaurant Linde: Raum für Feiern bis 40 Personen. Reservierung: 0761 22 33 44.', 'Café Rosa: Frühstück, Kuchen und Kaffee. Täglich 8–18 Uhr.'], answer: 0 },
          ],
        },
        {
          id: 'f-l3', title: 'Teil 3', instruction: 'Lesen Sie die Schilder. Richtig oder falsch?', instructionUz: 'Eʼlon va yozuvlarni oʻqing. Toʻgʻrimi yoki notoʻgʻri?',
          items: [
            { ...tf('f-l3-1', 'Die Bäckerei ist im August zwei Wochen geschlossen.', true), text: { kind: 'sign', body: 'Bäckerei Müller\nWir machen Urlaub!\nVom 1. bis 14. August geschlossen.' } },
            { ...tf('f-l3-2', 'Sie können sich am Freitag für einen Kurs anmelden.', false), text: { kind: 'sign', body: 'Sprachschule – 2. Stock\nAnmeldung: Raum 204\nMontag bis Donnerstag 9–17 Uhr' } },
            { ...tf('f-l3-3', 'In der Bibliothek darf man Kaffee trinken.', false), text: { kind: 'sign', body: 'Bibliothek\nBitte leise sein!\nEssen und Trinken verboten.' } },
            { ...tf('f-l3-4', 'Heute können Sie zu Dr. Roth gehen.', true), text: { kind: 'sign', body: 'Praxis Dr. Klein\nHeute keine Sprechstunde.\nVertretung: Dr. Roth, Bahnhofstraße 5' } },
            { ...tf('f-l3-5', 'Am Samstag können Sie bis 21 Uhr schwimmen.', false), text: { kind: 'sign', body: 'Schwimmbad – Öffnungszeiten\nMontag bis Freitag 7–21 Uhr\nSamstag und Sonntag 9–18 Uhr' } },
          ],
        },
      ],
    },
    {
      id: 'schreiben', points: 25, pass: PASS,
      tasks: [
        {
          id: 'f-s1', title: 'Teil 1', instruction: 'Lesen Sie den Text und füllen Sie das Formular aus.', instructionUz: 'Matnni oʻqing va shaklni toʻldiring.',
          texts: [{
            kind: 'note',
            body: 'Ihr Freund Bobur Rahimov möchte im Fitnessstudio „FitPlus“ trainieren. Er ist am 12. Oktober 1999 geboren. Er wohnt in Frankfurt, in der Gartenstraße 23. Er arbeitet bis 17 Uhr, darum möchte er abends trainieren. Er bezahlt mit Karte.',
          }],
          items: [
            { id: 'f-s1-1', type: 'form', label: 'Familienname', answer: ['Rahimov'] },
            { id: 'f-s1-2', type: 'form', label: 'Geburtsdatum', answer: ['12. Oktober 1999', '12.10.1999', '12.10.99', '12. 10. 1999'] },
            { id: 'f-s1-3', type: 'form', label: 'Straße und Hausnummer', answer: ['Gartenstraße 23', 'Gartenstrasse 23', 'Gartenstr. 23', 'Gartenstr 23'] },
            { id: 'f-s1-4', type: 'form', label: 'Training: morgens oder abends?', answer: ['abends', 'am Abend', 'Abend'] },
            { id: 'f-s1-5', type: 'form', label: 'Bezahlung: bar oder mit Karte?', answer: ['Karte', 'mit Karte'] },
          ],
        },
        {
          id: 'f-s2', title: 'Teil 2',
          instruction: 'Schreiben Sie zu jedem Punkt ein bis zwei Sätze (circa 30 Wörter). Vergessen Sie Anrede und Gruß nicht.',
          instructionUz: 'Har bir band boʻyicha bir-ikki gap yozing (taxminan 30 soʻz). Murojaat va xayrlashuvni unutmang.',
          items: [{
            id: 'f-s2-1', type: 'writing',
            prompt: 'Sie möchten einen Deutschkurs machen. Schreiben Sie eine E-Mail an die Sprachschule.',
            promptUz: 'Siz nemis tili kursiga yozilmoqchisiz. Til maktabiga elektron xat yozing.',
            points: ['Welchen Kurs möchten Sie machen?', 'Wann haben Sie Zeit?', 'Fragen Sie nach dem Preis.'],
            words: 30,
            model: 'Sehr geehrte Damen und Herren,\nich möchte einen Deutschkurs A1 machen. Ich arbeite am Vormittag, darum habe ich nur am Abend oder am Wochenende Zeit. Wie viel kostet der Kurs? Bitte schreiben Sie mir.\nMit freundlichen Grüßen\nNilufar Karimova',
          }],
        },
      ],
    },
    {
      id: 'sprechen', points: 25, pass: PASS,
      tasks: [
        {
          id: 'f-p1', title: '1. Sich vorstellen', instruction: 'Stellen Sie sich vor. Sprechen Sie oder schreiben Sie.', instructionUz: 'Oʻzingizni tanishtiring. Gapiring yoki yozing.',
          items: [{
            id: 'f-p1-1', type: 'speaking', kind: 'intro', max: 7,
            prompt: 'Stellen Sie sich vor.',
            promptUz: 'Oʻzingizni tanishtiring: kartalardagi barcha savollarga javob bering.',
            cards: ['Name?', 'Alter?', 'Land?', 'Wohnort?', 'Sprachen?', 'Beruf?', 'Hobby?'],
            model: 'Guten Tag! Ich heiße Kamola Usmonova. Ich bin 23 Jahre alt. Ich komme aus Usbekistan, aus Samarkand. Jetzt wohne ich in Taschkent. Ich spreche Usbekisch, Russisch, Englisch und ein bisschen Deutsch. Ich bin Krankenschwester. In meiner Freizeit lese ich gern.',
          }],
        },
        {
          id: 'f-p2', title: '2. Mit Partner sprechen', instruction: 'Ihr Partner fragt. Hören Sie die Frage und antworten Sie.', instructionUz: 'Sherigingiz savol beradi. Savolni tinglang va javob bering.',
          items: [
            partner(1, 'Was machst du gern in deiner Freizeit?', 'Ich lese gern und am Wochenende spiele ich Fußball.'),
            partner(2, 'Wie ist deine Wohnung?', 'Meine Wohnung ist klein, aber modern. Sie hat zwei Zimmer und eine Küche.'),
            partner(3, 'Was isst du gern zum Frühstück?', 'Zum Frühstück esse ich gern Brot mit Käse und ich trinke Tee.'),
          ],
        },
        {
          id: 'f-p3', title: '3. Gestern (Perfekt)', instruction: 'Was haben Sie gestern gemacht? Erzählen Sie im Perfekt.', instructionUz: 'Kecha nima qildingiz? Perfekt zamonida aytib bering.',
          items: [{
            id: 'f-p3-1', type: 'speaking', kind: 'yesterday', max: 6,
            prompt: 'Was haben Sie gestern gemacht? Sagen Sie 3–4 Sätze im Perfekt.',
            promptUz: 'Kecha nima qildingiz? Perfekt zamonida 3–4 ta gap ayting.',
            cards: ['aufstehen', 'frühstücken', 'arbeiten / lernen', 'am Abend'],
            model: 'Gestern bin ich um sieben Uhr aufgestanden. Ich habe Brot gegessen und Tee getrunken. Dann habe ich bis 17 Uhr gearbeitet. Am Abend habe ich meine Freunde getroffen.',
          }],
        },
        {
          id: 'f-p4', title: '4. Fragen (Kärtchen)', instruction: 'Fragen Sie mit jeder Karte.', instructionUz: 'Har bir karta bilan savol tuzing.',
          items: [{
            id: 'f-p4-1', type: 'speaking', kind: 'cards', max: 6,
            prompt: 'Stellen Sie zu jeder Karte eine Frage.',
            promptUz: 'Har bir karta boʻyicha bitta savol tuzing.',
            cards: ['Wochenende', 'Geburtstag', 'Hobby'],
            model: 'Was machst du am Wochenende?\nWann hast du Geburtstag?\nWas ist dein Hobby?',
          }],
        },
      ],
    },
  ],
};

export const GERMAN_A1_TESTS: Test[] = [MODUL_1, MODUL_2, MODUL_3, MODUL_4, FINAL];
