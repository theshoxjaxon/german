/**
 * Mock tests for the German course (Momente A1 → Goethe-Zertifikat A1: Start Deutsch 1). Written
 * for this app in the style of the exam, with words from the lessons. Server-only: this file has
 * the answer key; the browser gets each test through publicTest().
 *
 * Speakers in listening scripts: a = a woman, b = a man, n = an announcer.
 */
import type { Test } from '../../tests/types';

const HOEREN_1 = { title: 'Teil 1', instruction: 'Sie hören kurze Gespräche. Kreuzen Sie an: a, b oder c. Sie hören jeden Text zweimal.', instructionUz: 'Qisqa suhbatlarni eshitasiz. a, b yoki c ni belgilang. Har bir matn ikki marta eshittiriladi.' };
const LESEN_RF = 'Lesen Sie den Text und die Aufgaben. Richtig oder falsch?';
const LESEN_RF_UZ = 'Matn va topshiriqlarni oʻqing. Toʻgʻrimi yoki notoʻgʻri?';
const LESEN_AB = 'Lesen Sie die Aufgaben und die Texte. Welcher Text passt: a oder b?';
const LESEN_AB_UZ = 'Topshiriqlar va matnlarni oʻqing. Qaysi matn mos keladi: a yoki b?';
const GRAMMATIK = 'Ergänzen Sie oder kreuzen Sie an.';
const GRAMMATIK_UZ = 'Boʻsh joyni toʻldiring yoki toʻgʻri javobni belgilang.';
const FORM = 'Lesen Sie den Text und füllen Sie das Formular aus.';
const FORM_UZ = 'Matnni oʻqing va shaklni toʻldiring.';
const WRITE = 'Schreiben Sie zu jedem Punkt ein bis zwei Sätze (circa 30 Wörter). Vergessen Sie Anrede und Gruß nicht.';
const WRITE_UZ = 'Har bir band boʻyicha bir-ikki gap yozing (taxminan 30 soʻz). Murojaat va xayrlashuvni unutmang.';
const SPEAK_1 = { title: 'Teil 1', instruction: 'Stellen Sie sich vor. Sprechen Sie oder schreiben Sie.', instructionUz: 'Oʻzingizni tanishtiring. Gapiring yoki yozing.' };
const SPEAK_2_UZ = 'Har bir kartadagi soʻz bilan savol tuzing va oʻzingiz javob bering.';
const SPEAK_3_UZ = 'Rasmlarga qarab xushmuomala iltimos tuzing.';

/* ============================== Test 1: Lektion 1–3 ============================== */

const TEST_1: Test = {
  id: 'a1-test-1',
  course: 'german',
  title: 'Test 1',
  subtitle: 'Lektion 1–3',
  minutes: 45,
  topics: 'Greetings, introducing yourself, countries and languages, numbers, age, jobs, family',
  sections: [
    {
      id: 'hoeren',
      tasks: [
        {
          id: 't1-h1', ...HOEREN_1,
          items: [
            {
              id: 't1-h1-1', type: 'choice', prompt: 'Woher kommt Jasur?', options: ['aus Taschkent', 'aus Samarkand', 'aus Buchara'], answer: 1,
              audio: [
                { who: 'a', text: 'Hallo, ich bin Anna. Und wie heißt du?' },
                { who: 'b', text: 'Ich heiße Jasur. Jasur Karimov.' },
                { who: 'a', text: 'Woher kommst du, Jasur? Aus Taschkent?' },
                { who: 'b', text: 'Nein, ich komme aus Samarkand.' },
              ],
            },
            {
              id: 't1-h1-2', type: 'choice', prompt: 'Wie alt ist die Schwester?', options: ['16', '20', '26'], answer: 0,
              audio: [
                { who: 'a', text: 'Wie alt ist dein Bruder?' },
                { who: 'b', text: 'Mein Bruder? Er ist zwanzig. Und meine Schwester ist sechzehn.' },
              ],
            },
            {
              id: 't1-h1-3', type: 'choice', prompt: 'Wie ist die Telefonnummer von Herrn Weber?', options: ['0176 38 42 59', '0176 38 24 95', '0176 38 42 95'], answer: 2,
              audio: [
                { who: 'a', text: 'Wie ist Ihre Telefonnummer, Herr Weber?' },
                { who: 'b', text: 'Null, eins, sieben, sechs. Drei, acht. Vier, zwei. Neun, fünf.' },
                { who: 'a', text: 'Danke schön.' },
              ],
            },
            {
              id: 't1-h1-4', type: 'choice', prompt: 'Was ist Frau Novak von Beruf?', options: ['Lehrerin', 'Ärztin', 'Studentin'], answer: 1,
              audio: [
                { who: 'b', text: 'Was sind Sie von Beruf, Frau Novak? Sind Sie Lehrerin?' },
                { who: 'a', text: 'Nein, ich bin Ärztin. Ich arbeite in Wien.' },
              ],
            },
          ],
        },
        {
          id: 't1-h2', title: 'Teil 2',
          instruction: 'Sie hören einen Text. Richtig oder falsch? Sie hören den Text zweimal.',
          instructionUz: 'Matnni eshitasiz. Toʻgʻrimi yoki notoʻgʻri? Matn ikki marta eshittiriladi.',
          audio: [
            { who: 'a', text: 'Hallo! Ich bin Maria. Ich bin dreiundzwanzig Jahre alt und komme aus Spanien. Jetzt wohne ich in Berlin.' },
            { who: 'a', text: 'Ich spreche Spanisch, Englisch und ein bisschen Deutsch. Ich bin Studentin.' },
            { who: 'a', text: 'Meine Familie wohnt in Madrid: mein Vater, meine Mutter und mein Bruder Pablo.' },
          ],
          items: [
            { id: 't1-h2-1', type: 'truefalse', prompt: 'Maria ist 23 Jahre alt.', answer: true },
            { id: 't1-h2-2', type: 'truefalse', prompt: 'Maria wohnt in Madrid.', answer: false },
            { id: 't1-h2-3', type: 'truefalse', prompt: 'Maria spricht drei Sprachen.', answer: true },
            { id: 't1-h2-4', type: 'truefalse', prompt: 'Maria hat eine Schwester.', answer: false },
          ],
        },
      ],
    },
    {
      id: 'lesen',
      tasks: [
        {
          id: 't1-l1', title: 'Teil 1', instruction: LESEN_RF, instructionUz: LESEN_RF_UZ,
          texts: [{
            kind: 'email',
            title: 'Hallo aus Köln!',
            body: 'Liebe Frau Schulz,\n\nich heiße Bekzod Aliyev und komme aus Usbekistan. Ich bin 19 Jahre alt und wohne jetzt in Köln. Hier lerne ich Deutsch. Ich spreche Usbekisch, Russisch und Englisch.\n\nMein Vater ist Ingenieur und meine Mutter ist Lehrerin. Ich habe eine Schwester. Sie heißt Malika und ist 15.\n\nViele Grüße\nBekzod',
          }],
          items: [
            { id: 't1-l1-1', type: 'truefalse', prompt: 'Bekzod wohnt in Usbekistan.', answer: false },
            { id: 't1-l1-2', type: 'truefalse', prompt: 'Bekzod lernt Deutsch.', answer: true },
            { id: 't1-l1-3', type: 'truefalse', prompt: 'Bekzods Mutter ist Lehrerin.', answer: true },
            { id: 't1-l1-4', type: 'truefalse', prompt: 'Bekzod hat einen Bruder.', answer: false },
            { id: 't1-l1-5', type: 'truefalse', prompt: 'Malika ist 19 Jahre alt.', answer: false },
          ],
        },
        {
          id: 't1-l2', title: 'Teil 2', instruction: LESEN_AB, instructionUz: LESEN_AB_UZ,
          items: [
            {
              id: 't1-l2-1', type: 'choice', prompt: 'Sie suchen einen Deutschkurs am Abend.',
              options: ['Deutschkurs A1: Montag bis Freitag, 9 bis 12 Uhr. Sprachschule Lingua.', 'Deutsch für Anfänger: Dienstag und Donnerstag, 18 bis 20 Uhr. Volkshochschule.'], answer: 1,
            },
            {
              id: 't1-l2-2', type: 'choice', prompt: 'Sie möchten eine Brieffreundin aus Österreich.',
              options: ['Hallo! Ich heiße Lena, ich bin 20 und komme aus Wien. Ich suche Freunde aus der ganzen Welt!', 'Hi! Ich bin Tom aus Hamburg. Ich spreche Englisch und Deutsch und suche Freunde in Spanien.'], answer: 0,
            },
            {
              id: 't1-l2-3', type: 'choice', prompt: 'Sie sprechen Russisch und Deutsch und suchen Arbeit.',
              options: ['Sprachschule sucht Lehrerin für Englisch. Tel. 0221 45 67 89', 'Hotel Berlin sucht Mitarbeiter mit Russisch und Deutsch. Tel. 030 12 34 56'], answer: 1,
            },
          ],
        },
      ],
    },
    {
      id: 'grammatik',
      tasks: [
        {
          id: 't1-g1', title: 'Verben', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 't1-g1-1', type: 'gap', prompt: 'Ich ___ Malika.', hint: 'heißen', answer: ['heiße', 'heisse'] },
            { id: 't1-g1-2', type: 'gap', prompt: 'Woher ___ du?', hint: 'kommen', answer: ['kommst'] },
            { id: 't1-g1-3', type: 'gap', prompt: 'Wir ___ in Taschkent.', hint: 'wohnen', answer: ['wohnen'] },
            { id: 't1-g1-4', type: 'gap', prompt: 'Ihr ___ Studenten, oder?', hint: 'sein', answer: ['seid'] },
            { id: 't1-g1-5', type: 'gap', prompt: 'Er ___ Englisch und Deutsch.', hint: 'sprechen', answer: ['spricht'] },
            { id: 't1-g1-6', type: 'choice', prompt: '___ Sie Herr Müller?', options: ['Bist', 'Sind', 'Ist'], answer: 1 },
            { id: 't1-g1-7', type: 'choice', prompt: 'Er ___ zwei Kinder.', options: ['habe', 'hast', 'hat'], answer: 2 },
          ],
        },
        {
          id: 't1-g2', title: 'Fragen und Sätze', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 't1-g2-1', type: 'choice', prompt: 'Das ist ___ Bruder. Er heißt Timur.', options: ['mein', 'meine', 'meinen'], answer: 0 },
            { id: 't1-g2-2', type: 'choice', prompt: 'Ist das ___ Mutter, Anna?', options: ['dein', 'deine', 'du'], answer: 1 },
            { id: 't1-g2-3', type: 'choice', prompt: '___ alt bist du?', options: ['Wie', 'Wo', 'Was'], answer: 0 },
            { id: 't1-g2-4', type: 'choice', prompt: '___ wohnen Sie? – In Berlin.', options: ['Woher', 'Wo', 'Wer'], answer: 1 },
            { id: 't1-g2-5', type: 'choice', prompt: 'Welcher Satz ist richtig?', options: ['Heute ich lerne Deutsch.', 'Heute lerne ich Deutsch.', 'Heute Deutsch lerne ich.'], answer: 1 },
            { id: 't1-g2-6', type: 'choice', prompt: 'Was sind Sie ___ Beruf?', options: ['von', 'aus', 'in'], answer: 0 },
          ],
        },
        {
          id: 't1-g3', title: 'Wortschatz', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 't1-g3-1', type: 'choice', prompt: 'Der Vater von meinem Vater ist mein ___.', options: ['Onkel', 'Großvater', 'Bruder'], answer: 1 },
            { id: 't1-g3-2', type: 'choice', prompt: '18 = ?', options: ['achtzig', 'achtzehn', 'acht'], answer: 1 },
          ],
        },
      ],
    },
    {
      id: 'schreiben',
      tasks: [
        {
          id: 't1-s1', title: 'Teil 1', instruction: FORM, instructionUz: FORM_UZ,
          texts: [{
            kind: 'note',
            body: 'Ihre Freundin Dilnoza Rashidova möchte einen Deutschkurs machen. Sie ist 22 Jahre alt und kommt aus Usbekistan. Sie wohnt in Leipzig, in der Goethestraße 12. Sie ist Studentin und spricht Usbekisch, Russisch und Englisch.',
          }],
          items: [
            { id: 't1-s1-1', type: 'form', label: 'Familienname', answer: ['Rashidova'] },
            { id: 't1-s1-2', type: 'form', label: 'Alter', answer: ['22', '22 Jahre', 'zweiundzwanzig'] },
            { id: 't1-s1-3', type: 'form', label: 'Herkunftsland', answer: ['Usbekistan'] },
            { id: 't1-s1-4', type: 'form', label: 'Wohnort', answer: ['Leipzig'] },
            { id: 't1-s1-5', type: 'form', label: 'Beruf', answer: ['Studentin'] },
          ],
        },
        {
          id: 't1-s2', title: 'Teil 2', instruction: WRITE, instructionUz: WRITE_UZ,
          items: [{
            id: 't1-s2-1', type: 'writing',
            prompt: 'Sie haben eine neue Brieffreundin in Deutschland, Lena. Schreiben Sie ihr eine E-Mail.',
            promptUz: 'Germaniyada yangi yozishma doʻstingiz bor: Lena. Unga elektron xat yozing.',
            points: ['Name, Alter und Herkunft', 'Ihre Familie', 'Ihre Sprachen'],
            words: 30,
            model: 'Liebe Lena,\nich heiße Aziz, ich bin 20 Jahre alt und komme aus Usbekistan. Ich wohne in Taschkent. Meine Familie ist groß: Ich habe zwei Brüder und eine Schwester. Ich spreche Usbekisch, Russisch und ein bisschen Deutsch.\nViele Grüße\nAziz',
          }],
        },
      ],
    },
    {
      id: 'sprechen',
      tasks: [
        {
          id: 't1-p1', ...SPEAK_1,
          items: [{
            id: 't1-p1-1', type: 'speaking', part: 1, max: 3,
            prompt: 'Stellen Sie sich vor.',
            promptUz: 'Oʻzingizni tanishtiring: kartalardagi barcha savollarga javob bering.',
            cards: ['Name?', 'Alter?', 'Land?', 'Wohnort?', 'Sprachen?', 'Beruf?', 'Hobby?'],
            model: 'Ich heiße Malika Karimova. Ich bin 19 Jahre alt. Ich komme aus Usbekistan und wohne in Taschkent. Ich spreche Usbekisch, Russisch und ein bisschen Deutsch. Ich bin Studentin. Mein Hobby ist Musik.',
          }],
        },
        {
          id: 't1-p2', title: 'Teil 2', instruction: 'Thema „Familie“. Fragen Sie mit jeder Karte und antworten Sie.', instructionUz: SPEAK_2_UZ,
          items: [{
            id: 't1-p2-1', type: 'speaking', part: 2, max: 6,
            prompt: 'Thema: Familie. Stellen Sie zu jeder Karte eine Frage und antworten Sie.',
            promptUz: 'Mavzu: oila. Har bir karta bilan savol bering va unga javob bering.',
            cards: ['Geschwister', 'Eltern', 'Beruf'],
            model: 'Hast du Geschwister? – Ja, ich habe einen Bruder und eine Schwester.\nWo wohnen deine Eltern? – Meine Eltern wohnen in Samarkand.\nWas bist du von Beruf? – Ich bin Student.',
          }],
        },
        {
          id: 't1-p3', title: 'Teil 3', instruction: 'Im Deutschkurs. Bitten Sie Ihre Lehrerin um etwas.', instructionUz: SPEAK_3_UZ,
          items: [{
            id: 't1-p3-1', type: 'speaking', part: 3, max: 6,
            prompt: 'Sie verstehen etwas nicht. Bitten Sie Ihre Lehrerin höflich um Hilfe: eine Bitte zu jeder Karte.',
            promptUz: 'Siz nimanidir tushunmayapsiz. Oʻqituvchingizdan har bir karta boʻyicha xushmuomala iltimos qiling.',
            cards: ['🔁 noch einmal', '🔤 buchstabieren', '🐢 langsam'],
            model: 'Können Sie das bitte noch einmal sagen?\nKönnen Sie das bitte buchstabieren?\nSprechen Sie bitte langsam.',
          }],
        },
      ],
    },
  ],
};

export const GERMAN_A1_TESTS: Test[] = [TEST_1];
