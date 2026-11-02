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
const HOEREN_2 = { title: 'Teil 2', instruction: 'Sie hören einen Text. Richtig oder falsch? Sie hören den Text zweimal.', instructionUz: 'Matnni eshitasiz. Toʻgʻrimi yoki notoʻgʻri? Matn ikki marta eshittiriladi.' };
const SIGNS = 'Lesen Sie die Schilder. Richtig oder falsch?';
const SIGNS_UZ = 'Eʼlon va yozuvlarni oʻqing. Toʻgʻrimi yoki notoʻgʻri?';
const INTRO_CARDS = ['Name?', 'Alter?', 'Land?', 'Wohnort?', 'Sprachen?', 'Beruf?', 'Hobby?'];

/** Sprechen Teil 1, the same in every test: introduce yourself with the seven cards. */
const intro = (prefix: string, model: string): Test['sections'][number]['tasks'][number] => ({
  id: `${prefix}-p1`, ...SPEAK_1,
  items: [{
    id: `${prefix}-p1-1`, type: 'speaking', part: 1, max: 3,
    prompt: 'Stellen Sie sich vor.',
    promptUz: 'Oʻzingizni tanishtiring: kartalardagi barcha savollarga javob bering.',
    cards: INTRO_CARDS,
    model,
  }],
});

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


/* ============================== Test 2: Lektion 4–6 ============================== */

const TEST_2: Test = {
  id: 'a1-test-2',
  course: 'german',
  title: 'Test 2',
  subtitle: 'Lektion 4–6',
  minutes: 45,
  topics: 'Home and furniture, shopping and prices, things and colours, the office, appointments, the phone',
  sections: [
    {
      id: 'hoeren',
      tasks: [
        {
          id: 't2-h1', ...HOEREN_1,
          items: [
            {
              id: 't2-h1-1', type: 'choice', prompt: 'Wie viel kostet die Lampe?', options: ['19 Euro', '29 Euro', '90 Euro'], answer: 1,
              audio: [
                { who: 'a', text: 'Entschuldigung, wie viel kostet die Lampe hier?' },
                { who: 'b', text: 'Die Lampe? Die kostet neunundzwanzig Euro. Sie ist im Sonderangebot.' },
                { who: 'a', text: 'Oh, das ist günstig!' },
              ],
            },
            {
              id: 't2-h1-2', type: 'choice', prompt: 'Welche Farbe hat Pauls Tasche?', options: ['schwarz', 'rot', 'blau'], answer: 2,
              audio: [
                { who: 'a', text: 'Paul, ist das deine Tasche? Die schwarze hier?' },
                { who: 'b', text: 'Nein, meine Tasche ist nicht schwarz. Sie ist blau.' },
              ],
            },
            {
              id: 't2-h1-3', type: 'choice', prompt: 'Wann ist der Termin?', options: ['am Montag um 10 Uhr', 'am Dienstag um 10 Uhr', 'am Dienstag um 12 Uhr'], answer: 1,
              audio: [
                { who: 'a', text: 'Firma Schneider, guten Tag. Was kann ich für Sie tun?' },
                { who: 'b', text: 'Guten Tag, hier ist Aliyev. Ich brauche einen Termin bei Herrn Schneider.' },
                { who: 'a', text: 'Am Montag ist Herr Schneider leider nicht da. Geht es am Dienstag um zehn Uhr?' },
                { who: 'b', text: 'Ja, Dienstag um zehn ist gut. Danke!' },
              ],
            },
            {
              id: 't2-h1-4', type: 'choice', prompt: 'Was braucht Lena für ihr Zimmer?', options: ['einen Tisch', 'einen Schrank', 'ein Regal'], answer: 2,
              audio: [
                { who: 'b', text: 'Lena, brauchst du noch einen Tisch für dein Zimmer?' },
                { who: 'a', text: 'Nein, einen Tisch habe ich schon. Aber ich brauche ein Regal für meine Bücher.' },
              ],
            },
          ],
        },
        {
          id: 't2-h2', ...HOEREN_2,
          audio: [
            { who: 'b', text: 'Guten Tag, Frau Weber, hier ist Thomas Klein von der Firma Bürowelt.' },
            { who: 'b', text: 'Ihre Bestellung ist da: der Drucker und zwei Schreibtischstühle. Der Computer kommt leider erst nächste Woche.' },
            { who: 'b', text: 'Wir bringen die Sachen am Freitag um neun Uhr. Bitte rufen Sie uns zurück: null drei null, vier fünf, sechs sieben, acht neun. Vielen Dank und auf Wiederhören!' },
          ],
          items: [
            { id: 't2-h2-1', type: 'truefalse', prompt: 'Herr Klein arbeitet bei Bürowelt.', answer: true },
            { id: 't2-h2-2', type: 'truefalse', prompt: 'Der Computer ist schon da.', answer: false },
            { id: 't2-h2-3', type: 'truefalse', prompt: 'Die Sachen kommen am Freitag.', answer: true },
            { id: 't2-h2-4', type: 'truefalse', prompt: 'Frau Weber soll eine E-Mail schreiben.', answer: false },
          ],
        },
      ],
    },
    {
      id: 'lesen',
      tasks: [
        {
          id: 't2-l1', title: 'Teil 1', instruction: LESEN_RF, instructionUz: LESEN_RF_UZ,
          texts: [{
            kind: 'email',
            title: 'Meine neue Wohnung',
            body: 'Liebe Aziza,\n\nich habe jetzt eine neue Wohnung in Hamburg! Sie hat zwei Zimmer, eine Küche und ein Bad. Die Küche ist klein, aber sehr modern. Das Wohnzimmer ist groß und hell.\n\nIch brauche noch Möbel. Ein Bett und einen Schrank habe ich schon, aber ich habe kein Sofa und keinen Tisch. Am Samstag gehe ich in ein Möbelgeschäft. Da gibt es viele Sonderangebote. Kommst du mit?\n\nLiebe Grüße\nSophie',
          }],
          items: [
            { id: 't2-l1-1', type: 'truefalse', prompt: 'Sophies Wohnung hat zwei Zimmer.', answer: true },
            { id: 't2-l1-2', type: 'truefalse', prompt: 'Die Küche ist groß.', answer: false },
            { id: 't2-l1-3', type: 'truefalse', prompt: 'Sophie hat schon ein Bett.', answer: true },
            { id: 't2-l1-4', type: 'truefalse', prompt: 'Sophie hat einen Tisch.', answer: false },
            { id: 't2-l1-5', type: 'truefalse', prompt: 'Sophie geht am Sonntag in ein Möbelgeschäft.', answer: false },
          ],
        },
        {
          id: 't2-l2', title: 'Teil 2', instruction: LESEN_AB, instructionUz: LESEN_AB_UZ,
          items: [
            {
              id: 't2-l2-1', type: 'choice', prompt: 'Sie brauchen ein Sofa. Es soll nicht teuer sein.',
              options: ['Möbel Krone: Sofas ab 899 Euro. Neue Modelle aus Italien!', 'Sofa, zwei Jahre alt, wie neu, nur 80 Euro. Tel. 0151 22 33 44'], answer: 1,
            },
            {
              id: 't2-l2-2', type: 'choice', prompt: 'Ihr Computer hat ein Problem.',
              options: ['Computer-Hilfe: Wir helfen bei Problemen mit Computer, Drucker und WLAN. Mo–Fr 9–18 Uhr.', 'Büro Plus: Schreibtische, Stühle und Lampen für Ihr Büro. Jetzt 20 % billiger!'], answer: 0,
            },
            {
              id: 't2-l2-3', type: 'choice', prompt: 'Sie arbeiten bis 18 Uhr. Sie brauchen ein Handy und haben nur am Abend Zeit.',
              options: ['Handy-Shop Mobil: Montag bis Freitag 9 bis 18 Uhr, Samstag 10 bis 14 Uhr.', 'Elektro-Markt: Handys, Computer und mehr. Montag bis Samstag 10 bis 21 Uhr.'], answer: 1,
            },
          ],
        },
      ],
    },
    {
      id: 'grammatik',
      tasks: [
        {
          id: 't2-g1', title: 'Artikel und Akkusativ', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 't2-g1-1', type: 'choice', prompt: 'Das ist ___ Stuhl.', options: ['ein', 'eine', 'einen'], answer: 0 },
            { id: 't2-g1-2', type: 'choice', prompt: 'Ich brauche ___ Lampe.', options: ['ein', 'eine', 'einen'], answer: 1 },
            { id: 't2-g1-3', type: 'gap', prompt: 'Wir haben ___ Sofa.', hint: 'kein', answer: ['kein'] },
            { id: 't2-g1-4', type: 'gap', prompt: 'Ich kaufe ___ Schrank.', hint: 'ein', answer: ['einen'] },
            { id: 't2-g1-5', type: 'choice', prompt: 'Hast du ___ Computer?', options: ['ein', 'einen', 'eine'], answer: 1 },
            { id: 't2-g1-6', type: 'choice', prompt: '___ Tisch ist neu.', options: ['Der', 'Die', 'Das'], answer: 0 },
            { id: 't2-g1-7', type: 'choice', prompt: 'Wie findest du ___ Bild?', options: ['der', 'die', 'das'], answer: 2 },
            { id: 't2-g1-8', type: 'choice', prompt: 'Der Schrank ist nicht neu. ___ ist alt.', options: ['Er', 'Sie', 'Es'], answer: 0 },
          ],
        },
        {
          id: 't2-g2', title: 'Plural', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 't2-g2-1', type: 'choice', prompt: 'ein Buch – zwei ___', options: ['Buchs', 'Bücher', 'Buchen'], answer: 1 },
            { id: 't2-g2-2', type: 'choice', prompt: 'ein Stuhl – drei ___', options: ['Stühle', 'Stuhlen', 'Stuhls'], answer: 0 },
            { id: 't2-g2-3', type: 'gap', prompt: 'eine Lampe – vier ___', answer: ['Lampen'] },
          ],
        },
        {
          id: 't2-g3', title: 'Uhrzeit und Termine', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 't2-g3-1', type: 'choice', prompt: '14:30 Uhr = ?', options: ['vierzehn Uhr dreißig', 'vier Uhr dreißig', 'dreizehn Uhr dreißig'], answer: 0 },
            { id: 't2-g3-2', type: 'choice', prompt: 'Der Termin ist ___ Montag ___ 10 Uhr.', options: ['am … um', 'um … am', 'im … um'], answer: 0 },
            { id: 't2-g3-3', type: 'choice', prompt: 'Ich arbeite ___ 8 ___ 16 Uhr.', options: ['von … bis', 'am … um', 'um … am'], answer: 0 },
            { id: 't2-g3-4', type: 'choice', prompt: 'Am Telefon: ___ bitte später zurück.', options: ['Rufen Sie', 'Sie rufen', 'Rufst du'], answer: 0 },
          ],
        },
      ],
    },
    {
      id: 'schreiben',
      tasks: [
        {
          id: 't2-s1', title: 'Teil 1', instruction: FORM, instructionUz: FORM_UZ,
          texts: [{
            kind: 'note',
            body: 'Herr Timur Saidov möchte online einen Schreibtisch bestellen. Der Schreibtisch ist weiß und kostet 149 Euro. Herr Saidov wohnt in München, in der Bergstraße 7. Seine Telefonnummer ist 0176 45 12 98.',
          }],
          items: [
            { id: 't2-s1-1', type: 'form', label: 'Vorname', answer: ['Timur'] },
            { id: 't2-s1-2', type: 'form', label: 'Produkt', answer: ['Schreibtisch', 'ein Schreibtisch', 'der Schreibtisch'] },
            { id: 't2-s1-3', type: 'form', label: 'Farbe', answer: ['weiß', 'weiss'] },
            { id: 't2-s1-4', type: 'form', label: 'Preis', answer: ['149 Euro', '149', '149 €', '149,00 Euro', '149,00 €', '149 EUR'] },
            { id: 't2-s1-5', type: 'form', label: 'Wohnort', answer: ['München'] },
          ],
        },
        {
          id: 't2-s2', title: 'Teil 2', instruction: WRITE, instructionUz: WRITE_UZ,
          items: [{
            id: 't2-s2-1', type: 'writing',
            prompt: 'Sie haben morgen um 9 Uhr einen Termin mit Ihrer Kollegin, Frau Becker. Aber Sie haben keine Zeit. Schreiben Sie Frau Becker eine E-Mail.',
            promptUz: 'Ertaga soat 9 da hamkasbingiz Frau Becker bilan uchrashuvingiz bor, lekin vaqtingiz yoʻq. Unga elektron xat yozing.',
            points: ['Sie haben keine Zeit.', 'Warum nicht?', 'Ein neuer Termin: Tag und Uhrzeit'],
            words: 30,
            model: 'Liebe Frau Becker,\nleider habe ich morgen um 9 Uhr keine Zeit. Mein Sohn ist krank und ich bin zu Hause. Geht es am Donnerstag um 14 Uhr? Bitte schreiben Sie mir eine Nachricht.\nViele Grüße\nNodira Yusupova',
          }],
        },
      ],
    },
    {
      id: 'sprechen',
      tasks: [
        intro('t2', 'Mein Name ist Aziz Rahimov. Ich bin 24 Jahre alt. Ich komme aus Usbekistan und wohne jetzt in Namangan. Ich spreche Usbekisch, Russisch und ein bisschen Deutsch. Ich bin Bürokaufmann. Mein Hobby ist Fußball.'),
        {
          id: 't2-p2', title: 'Teil 2', instruction: 'Thema „Wohnung“. Fragen Sie mit jeder Karte und antworten Sie.', instructionUz: SPEAK_2_UZ,
          items: [{
            id: 't2-p2-1', type: 'speaking', part: 2, max: 6,
            prompt: 'Thema: Wohnung. Stellen Sie zu jeder Karte eine Frage und antworten Sie.',
            promptUz: 'Mavzu: uy-joy. Har bir karta bilan savol bering va unga javob bering.',
            cards: ['Zimmer', 'Möbel', 'Küche'],
            model: 'Wie viele Zimmer hat deine Wohnung? – Meine Wohnung hat drei Zimmer.\nHast du ein Sofa? – Ja, ich habe ein Sofa, aber keinen Sessel.\nWie ist deine Küche? – Meine Küche ist klein, aber modern.',
          }],
        },
        {
          id: 't2-p3', title: 'Teil 3', instruction: 'Im Büro. Bitten Sie Ihren Kollegen um etwas.', instructionUz: SPEAK_3_UZ,
          items: [{
            id: 't2-p3-1', type: 'speaking', part: 3, max: 6,
            prompt: 'Sie arbeiten im Büro. Bitten Sie Ihren Kollegen höflich um etwas: eine Bitte zu jeder Karte.',
            promptUz: 'Siz ofisda ishlaysiz. Hamkasbingizdan har bir karta boʻyicha xushmuomala iltimos qiling.',
            cards: ['✏️ Stift', '📞 Telefonnummer', '🖨️ Drucker'],
            model: 'Geben Sie mir bitte einen Stift.\nSagen Sie mir bitte die Telefonnummer von Frau Roth.\nEntschuldigung, wo ist bitte der Drucker?',
          }],
        },
      ],
    },
  ],
};

/* ============================== Test 3: Lektion 7–9 ============================== */

const TEST_3: Test = {
  id: 'a1-test-3',
  course: 'german',
  title: 'Test 3',
  subtitle: 'Lektion 7–9',
  minutes: 45,
  topics: 'Hobbies, free time and plans, weekdays and the time, food, café and restaurant, the working day',
  sections: [
    {
      id: 'hoeren',
      tasks: [
        {
          id: 't3-h1', ...HOEREN_1,
          items: [
            {
              id: 't3-h1-1', type: 'choice', prompt: 'Was macht Timur am Samstag?', options: ['Er spielt Fußball.', 'Er schwimmt.', 'Er fährt Rad.'], answer: 2,
              audio: [
                { who: 'a', text: 'Timur, was machst du am Wochenende? Spielst du wieder Fußball?' },
                { who: 'b', text: 'Nein, diesmal nicht. Am Samstag fahre ich mit Freunden Rad. Wir machen einen Ausflug.' },
              ],
            },
            {
              id: 't3-h1-2', type: 'choice', prompt: 'Wann treffen sich Anna und Paul?', options: ['um Viertel nach sieben', 'um halb acht', 'um Viertel vor acht'], answer: 2,
              audio: [
                { who: 'b', text: 'Anna, gehen wir heute ins Kino? Der Film beginnt um acht.' },
                { who: 'a', text: 'Gern! Treffen wir uns um Viertel vor acht am Kino?' },
                { who: 'b', text: 'Okay, Viertel vor acht. Bis dann!' },
              ],
            },
            {
              id: 't3-h1-3', type: 'choice', prompt: 'Was nimmt die Frau?', options: ['einen Kaffee und Kuchen', 'einen Tee und ein Eis', 'einen Kaffee und ein Brötchen'], answer: 0,
              audio: [
                { who: 'b', text: 'Guten Tag. Was möchten Sie?' },
                { who: 'a', text: 'Ich möchte einen Kaffee, bitte. Und ein Stück Apfelkuchen.' },
                { who: 'b', text: 'Mit Sahne?' },
                { who: 'a', text: 'Nein, danke. Ohne Sahne.' },
              ],
            },
            {
              id: 't3-h1-4', type: 'choice', prompt: 'Was kann Sara nicht gut?', options: ['singen', 'tanzen', 'kochen'], answer: 2,
              audio: [
                { who: 'b', text: 'Sara, du kannst ja super tanzen!' },
                { who: 'a', text: 'Danke! Ich tanze sehr gern. Und ich singe auch gern. Aber kochen kann ich gar nicht gut.' },
              ],
            },
          ],
        },
        {
          id: 't3-h2', ...HOEREN_2,
          audio: [
            { who: 'a', text: 'Hallo Jasur, hier ist Lisa. Hast du am Freitag Zeit? Ich koche am Abend für meine Freunde. Kommst du um sieben zum Essen?' },
            { who: 'a', text: 'Mein Bruder Max kommt auch. Ich mache Nudeln mit Gemüse, du isst ja kein Fleisch.' },
            { who: 'a', text: 'Schreibst du mir bis Donnerstag eine Nachricht? Tschüss!' },
          ],
          items: [
            { id: 't3-h2-1', type: 'truefalse', prompt: 'Lisa kocht am Freitag.', answer: true },
            { id: 't3-h2-2', type: 'truefalse', prompt: 'Das Essen ist um acht Uhr.', answer: false },
            { id: 't3-h2-3', type: 'truefalse', prompt: 'Jasur isst kein Fleisch.', answer: true },
            { id: 't3-h2-4', type: 'truefalse', prompt: 'Jasur soll Lisa anrufen.', answer: false },
          ],
        },
      ],
    },
    {
      id: 'lesen',
      tasks: [
        {
          id: 't3-l1', title: 'Teil 1', instruction: LESEN_RF, instructionUz: LESEN_RF_UZ,
          texts: [{
            kind: 'email',
            title: 'Mein neuer Job',
            body: 'Hallo Laura,\n\nwie geht es dir? Ich habe jetzt einen neuen Job in einer Grafikagentur. Ich arbeite Teilzeit, von Montag bis Mittwoch. Ich stehe um sechs Uhr auf und fange um acht Uhr an. Die Mittagspause ist um zwölf. Dann esse ich mit meinen Kollegen in der Kantine.\n\nAm Donnerstag und am Freitag habe ich frei. Dann gehe ich schwimmen oder ich treffe Freunde.\n\nDu kommst am Wochenende nach Leipzig, oder? Möchtest du am Samstag ins Kino gehen?\n\nLiebe Grüße\nMalika',
          }],
          items: [
            { id: 't3-l1-1', type: 'truefalse', prompt: 'Malika arbeitet jeden Tag.', answer: false },
            { id: 't3-l1-2', type: 'truefalse', prompt: 'Malika steht um sechs Uhr auf.', answer: true },
            { id: 't3-l1-3', type: 'truefalse', prompt: 'Malika isst mittags allein.', answer: false },
            { id: 't3-l1-4', type: 'truefalse', prompt: 'Am Donnerstag hat Malika frei.', answer: true },
            { id: 't3-l1-5', type: 'truefalse', prompt: 'Laura kommt am Wochenende nach Leipzig.', answer: true },
          ],
        },
        {
          id: 't3-l2', title: 'Teil 2', instruction: LESEN_AB, instructionUz: LESEN_AB_UZ,
          items: [
            {
              id: 't3-l2-1', type: 'choice', prompt: 'Sie möchten am Sonntag mit Ihrer Familie frühstücken.',
              options: ['Café Sonne: Frühstück jeden Tag von 8 bis 12 Uhr, auch am Sonntag!', 'Bäckerei Krause: Brot und Brötchen. Montag bis Samstag 6 bis 18 Uhr. Sonntag geschlossen.'], answer: 0,
            },
            {
              id: 't3-l2-2', type: 'choice', prompt: 'Sie spielen Gitarre und möchten mit anderen Leuten Musik machen.',
              options: ['Musikschule Ton: Gitarrenkurse für Anfänger, Dienstag 18 Uhr.', 'Wir sind eine Rockband und suchen einen Gitarristen. Wir spielen am Freitagabend zusammen. Tel. 0172 55 66 77'], answer: 1,
            },
            {
              id: 't3-l2-3', type: 'choice', prompt: 'Sie essen kein Fleisch und möchten im Restaurant essen.',
              options: ['Restaurant Bella: Pizza, Pasta und viele Gerichte mit Gemüse. Täglich 12–23 Uhr.', 'Steakhaus Texas: Die besten Steaks und Burger der Stadt! Täglich 17–24 Uhr.'], answer: 0,
            },
          ],
        },
      ],
    },
    {
      id: 'grammatik',
      tasks: [
        {
          id: 't3-g1', title: 'Modalverben', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 't3-g1-1', type: 'gap', prompt: 'Ich ___ gut schwimmen.', hint: 'können', answer: ['kann'] },
            { id: 't3-g1-2', type: 'gap', prompt: 'Du ___ super tanzen!', hint: 'können', answer: ['kannst'] },
            { id: 't3-g1-3', type: 'choice', prompt: 'Was ___ Sie trinken? – Einen Tee, bitte.', options: ['möchten', 'möchtest', 'möchte'], answer: 0 },
            { id: 't3-g1-4', type: 'choice', prompt: 'Welcher Satz ist richtig?', options: ['Ich kann Gitarre spielen.', 'Ich kann spielen Gitarre.', 'Ich spiele kann Gitarre.'], answer: 0 },
            { id: 't3-g1-5', type: 'choice', prompt: '___ du Schokolade? – Ja, sehr!', options: ['Magst', 'Mag', 'Mögt'], answer: 0 },
          ],
        },
        {
          id: 't3-g2', title: 'Trennbare Verben und Verben mit Vokalwechsel', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 't3-g2-1', type: 'choice', prompt: 'Der Unterricht ___ um neun Uhr ___.', options: ['fängt … an', 'an … fängt', 'fangt … an'], answer: 0 },
            { id: 't3-g2-2', type: 'gap', prompt: 'Ich ___ um sieben Uhr auf.', hint: 'aufstehen', answer: ['stehe'] },
            { id: 't3-g2-3', type: 'gap', prompt: '___ du gern Bücher?', hint: 'lesen', answer: ['Liest'] },
            { id: 't3-g2-4', type: 'gap', prompt: 'Er ___ eine Pizza.', hint: 'nehmen', answer: ['nimmt'] },
            { id: 't3-g2-5', type: 'gap', prompt: 'Was ___ du zum Frühstück?', hint: 'essen', answer: ['isst'] },
            { id: 't3-g2-6', type: 'choice', prompt: 'Anna ___ am Wochenende nach Berlin.', options: ['fährt', 'fahrt', 'fähre'], answer: 0 },
          ],
        },
        {
          id: 't3-g3', title: 'Zeit und „gern“', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 't3-g3-1', type: 'choice', prompt: 'Ich trinke gern Tee, aber ___ trinke ich Kaffee.', options: ['lieber', 'gern', 'gut'], answer: 0 },
            { id: 't3-g3-2', type: 'choice', prompt: 'Wir gehen ___ Samstag ins Kino.', options: ['am', 'um', 'im'], answer: 0 },
            { id: 't3-g3-3', type: 'choice', prompt: 'Der Film beginnt ___ halb acht.', options: ['um', 'am', 'im'], answer: 0 },
            { id: 't3-g3-4', type: 'choice', prompt: '7:45 Uhr: Es ist …', options: ['Viertel nach sieben.', 'Viertel vor acht.', 'halb acht.'], answer: 1 },
          ],
        },
      ],
    },
    {
      id: 'schreiben',
      tasks: [
        {
          id: 't3-s1', title: 'Teil 1', instruction: FORM, instructionUz: FORM_UZ,
          texts: [{
            kind: 'note',
            body: 'Ihr Freund Sardor Tursunov möchte einen Tanzkurs machen. Er ist 25 Jahre alt und wohnt in Bremen. Er hat nur am Wochenende Zeit, am liebsten am Samstag. Seine Telefonnummer ist 0157 89 12 34. Er kann schon ein bisschen tanzen.',
          }],
          items: [
            { id: 't3-s1-1', type: 'form', label: 'Familienname', answer: ['Tursunov'] },
            { id: 't3-s1-2', type: 'form', label: 'Alter', answer: ['25', '25 Jahre', 'fünfundzwanzig'] },
            { id: 't3-s1-3', type: 'form', label: 'Wohnort', answer: ['Bremen'] },
            { id: 't3-s1-4', type: 'form', label: 'Kurstag', answer: ['Samstag', 'am Samstag', 'Sa'] },
            { id: 't3-s1-5', type: 'form', label: 'Telefon', answer: ['0157 89 12 34', '0157891234', '0157 891234', '0157-89 12 34', '0157 8912 34'] },
          ],
        },
        {
          id: 't3-s2', title: 'Teil 2', instruction: WRITE, instructionUz: WRITE_UZ,
          items: [{
            id: 't3-s2-1', type: 'writing',
            prompt: 'Ihr Freund Paul möchte am Sonntag etwas mit Ihnen machen. Schreiben Sie Paul eine Nachricht.',
            promptUz: 'Doʻstingiz Paul yakshanba kuni siz bilan birga biror narsa qilmoqchi. Paulga xabar yozing.',
            points: ['Was möchten Sie machen?', 'Wann und wo treffen Sie sich?', 'Was essen oder trinken Sie danach?'],
            words: 30,
            model: 'Lieber Paul,\nam Sonntag habe ich Zeit! Möchtest du Rad fahren? Wir treffen uns um zehn Uhr am Bahnhof. Danach können wir im Café Sonne frühstücken. Ich nehme einen Kaffee und ein Stück Kuchen.\nBis Sonntag!\nAziz',
          }],
        },
      ],
    },
    {
      id: 'sprechen',
      tasks: [
        intro('t3', 'Ich heiße Dilnoza. Ich bin 21 Jahre alt. Ich komme aus Usbekistan, aus Buchara, und wohne jetzt in Taschkent. Ich spreche Usbekisch, Tadschikisch und ein bisschen Deutsch. Ich bin Studentin. In meiner Freizeit tanze ich gern.'),
        {
          id: 't3-p2', title: 'Teil 2', instruction: 'Thema „Freizeit“. Fragen Sie mit jeder Karte und antworten Sie.', instructionUz: SPEAK_2_UZ,
          items: [{
            id: 't3-p2-1', type: 'speaking', part: 2, max: 6,
            prompt: 'Thema: Freizeit. Stellen Sie zu jeder Karte eine Frage und antworten Sie.',
            promptUz: 'Mavzu: boʻsh vaqt. Har bir karta bilan savol bering va unga javob bering.',
            cards: ['Wochenende', 'Sport', 'Musik'],
            model: 'Was machst du am Wochenende? – Am Wochenende treffe ich Freunde.\nMachst du gern Sport? – Ja, ich schwimme gern.\nWelche Musik hörst du gern? – Ich höre gern Popmusik.',
          }],
        },
        {
          id: 't3-p3', title: 'Teil 3', instruction: 'Im Café. Bitten Sie den Kellner um etwas.', instructionUz: SPEAK_3_UZ,
          items: [{
            id: 't3-p3-1', type: 'speaking', part: 3, max: 6,
            prompt: 'Sie sind im Café. Bitten Sie den Kellner höflich um etwas: eine Bitte zu jeder Karte.',
            promptUz: 'Siz kafedasiz. Ofitsiantdan har bir karta boʻyicha xushmuomala iltimos qiling.',
            cards: ['☕ Kaffee', '📋 Speisekarte', '🧾 Rechnung'],
            model: 'Ich möchte bitte einen Kaffee.\nKönnen Sie mir bitte die Speisekarte bringen?\nDie Rechnung, bitte!',
          }],
        },
      ],
    },
  ],
};

/* ============================== Test 4: Lektion 10–12 ============================== */

const TEST_4: Test = {
  id: 'a1-test-4',
  course: 'german',
  title: 'Test 4',
  subtitle: 'Lektion 10–12',
  minutes: 45,
  topics: 'Travel, station and airport, the weekend, errands and opening times, the doctor, seasons, festivals and invitations',
  sections: [
    {
      id: 'hoeren',
      tasks: [
        {
          id: 't4-h1', ...HOEREN_1,
          items: [
            {
              id: 't4-h1-1', type: 'choice', prompt: 'Von welchem Gleis fährt der Zug nach Hamburg?', options: ['Gleis 3', 'Gleis 7', 'Gleis 13'], answer: 1,
              audio: [
                { who: 'n', text: 'Achtung an Gleis drei: Der Intercity nach Hamburg fährt heute von Gleis sieben ab. Ich wiederhole: Der Intercity nach Hamburg fährt heute von Gleis sieben.' },
              ],
            },
            {
              id: 't4-h1-2', type: 'choice', prompt: 'Wann ist die Party?', options: ['am 12. Mai', 'am 20. Mai', 'am 22. Mai'], answer: 2,
              audio: [
                { who: 'a', text: 'Hallo Tom, ich mache eine Geburtstagsparty. Kommst du?' },
                { who: 'b', text: 'Gern! Wann denn?' },
                { who: 'a', text: 'Am zweiundzwanzigsten Mai, das ist ein Samstag. Um acht Uhr.' },
              ],
            },
            {
              id: 't4-h1-3', type: 'choice', prompt: 'Was hat Ben am Wochenende gemacht?', options: ['Er war im Kino.', 'Er hat seine Wohnung aufgeräumt.', 'Er ist gewandert.'], answer: 2,
              audio: [
                { who: 'a', text: 'Na, Ben, wie war dein Wochenende?' },
                { who: 'b', text: 'Super! Ich bin mit meinem Bruder in den Bergen gewandert. Und du?' },
                { who: 'a', text: 'Ach, ich habe nur meine Wohnung aufgeräumt.' },
              ],
            },
            {
              id: 't4-h1-4', type: 'choice', prompt: 'Was muss Frau Lang machen?', options: ['Tabletten nehmen', 'im Bett bleiben und viel trinken', 'morgen wiederkommen'], answer: 1,
              audio: [
                { who: 'b', text: 'Sie haben eine Grippe, Frau Lang. Sie müssen drei Tage im Bett bleiben und viel trinken.' },
                { who: 'a', text: 'Brauche ich Tabletten?' },
                { who: 'b', text: 'Nein, Tabletten brauchen Sie nicht.' },
              ],
            },
          ],
        },
        {
          id: 't4-h2', ...HOEREN_2,
          audio: [
            { who: 'n', text: 'Liebe Fluggäste, der Flug LH zwölf vierunddreißig nach Taschkent hat leider eine Stunde Verspätung.' },
            { who: 'n', text: 'Er startet nicht um vierzehn Uhr dreißig, sondern um fünfzehn Uhr dreißig. Der neue Ausgang ist B zwölf.' },
            { who: 'n', text: 'Bitte kommen Sie um fünfzehn Uhr zum Ausgang. Vielen Dank.' },
          ],
          items: [
            { id: 't4-h2-1', type: 'truefalse', prompt: 'Der Flug geht nach Taschkent.', answer: true },
            { id: 't4-h2-2', type: 'truefalse', prompt: 'Der Flug startet um 14:30 Uhr.', answer: false },
            { id: 't4-h2-3', type: 'truefalse', prompt: 'Der Flug hat eine Stunde Verspätung.', answer: true },
            { id: 't4-h2-4', type: 'truefalse', prompt: 'Die Fluggäste gehen zum Ausgang A12.', answer: false },
          ],
        },
      ],
    },
    {
      id: 'lesen',
      tasks: [
        {
          id: 't4-l1', title: 'Teil 1', instruction: LESEN_RF, instructionUz: LESEN_RF_UZ,
          texts: [{
            kind: 'email',
            title: 'Mein Wochenende in München',
            body: 'Hallo Jonas,\n\nich bin wieder zu Hause! Die Reise nach München war super. Ich bin am Freitag mit dem Zug gefahren. Die Fahrt hat sechs Stunden gedauert, denn der Zug hatte eine Stunde Verspätung.\n\nIn München habe ich meine Tante besucht. Am Samstag sind wir zusammen zum Oktoberfest gegangen. Da waren so viele Leute! Am Sonntag hat es geregnet. Wir sind ins Museum gegangen und haben danach Kaffee getrunken.\n\nUnd du? Was hast du am Wochenende gemacht?\n\nViele Grüße\nAziza',
          }],
          items: [
            { id: 't4-l1-1', type: 'truefalse', prompt: 'Aziza ist mit dem Zug nach München gefahren.', answer: true },
            { id: 't4-l1-2', type: 'truefalse', prompt: 'Der Zug war pünktlich.', answer: false },
            { id: 't4-l1-3', type: 'truefalse', prompt: 'Aziza hat in München ihre Tante besucht.', answer: true },
            { id: 't4-l1-4', type: 'truefalse', prompt: 'Am Sonntag war das Wetter schön.', answer: false },
            { id: 't4-l1-5', type: 'truefalse', prompt: 'Am Samstag war Aziza auf dem Oktoberfest.', answer: true },
          ],
        },
        {
          id: 't4-l2', title: 'Teil 2', instruction: LESEN_AB, instructionUz: LESEN_AB_UZ,
          items: [
            {
              id: 't4-l2-1', type: 'choice', prompt: 'Sie sind krank. Es ist Samstagnachmittag.',
              options: ['Praxis Dr. Hofmann: Montag bis Freitag 8–12 und 14–18 Uhr.', 'Ärztlicher Notdienst: am Wochenende 8–22 Uhr. Tel. 116 117'], answer: 1,
            },
            {
              id: 't4-l2-2', type: 'choice', prompt: 'Sie möchten im Sommer eine Radtour machen.',
              options: ['Radtouren an der Donau: Juni bis September, 5 Tage, 390 Euro.', 'Skireisen in die Alpen: Dezember bis März, 7 Tage, 690 Euro.'], answer: 0,
            },
            {
              id: 't4-l2-3', type: 'choice', prompt: 'Sie möchten am Sonntag einkaufen.',
              options: ['Supermarkt am Hauptbahnhof: täglich 6–23 Uhr geöffnet, auch am Sonntag.', 'Markthalle: Montag bis Samstag 7–20 Uhr.'], answer: 0,
            },
          ],
        },
      ],
    },
    {
      id: 'grammatik',
      tasks: [
        {
          id: 't4-g1', title: 'Perfekt und Präteritum', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 't4-g1-1', type: 'choice', prompt: 'Ich ___ gestern Fußball gespielt.', options: ['habe', 'bin', 'hat'], answer: 0 },
            { id: 't4-g1-2', type: 'choice', prompt: 'Wir ___ nach Berlin gefahren.', options: ['haben', 'sind', 'seid'], answer: 1 },
            { id: 't4-g1-3', type: 'gap', prompt: 'Hast du schon die Hausaufgaben ___?', hint: 'machen', answer: ['gemacht'] },
            { id: 't4-g1-4', type: 'gap', prompt: 'Der Zug ist um zehn Uhr ___.', hint: 'ankommen', answer: ['angekommen'] },
            { id: 't4-g1-5', type: 'choice', prompt: 'Gestern ___ ich krank.', options: ['war', 'hatte', 'bin'], answer: 0 },
            { id: 't4-g1-6', type: 'choice', prompt: 'Am Wochenende ___ wir keine Zeit.', options: ['hatten', 'waren', 'hattet'], answer: 0 },
          ],
        },
        {
          id: 't4-g2', title: 'Imperativ und Modalverben', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 't4-g2-1', type: 'choice', prompt: 'Jonas, ___ bitte pünktlich!', options: ['komm', 'kommst', 'kommt'], answer: 0 },
            { id: 't4-g2-2', type: 'choice', prompt: 'Kinder, ___ bitte leise!', options: ['sei', 'seid', 'sind'], answer: 1 },
            { id: 't4-g2-3', type: 'gap', prompt: 'Im Kino ___ man nicht telefonieren.', hint: 'dürfen', answer: ['darf'] },
            { id: 't4-g2-4', type: 'gap', prompt: 'Ich bin krank. Ich ___ heute zum Arzt gehen.', hint: 'müssen', answer: ['muss'] },
          ],
        },
        {
          id: 't4-g3', title: 'Datum, Präpositionen und Pronomen', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 't4-g3-1', type: 'choice', prompt: 'Heute ist der ___ März. (3.)', options: ['dritte', 'dritten', 'drei'], answer: 0 },
            { id: 't4-g3-2', type: 'choice', prompt: 'Mein Geburtstag ist am ___ Juli. (1.)', options: ['erste', 'ersten', 'eins'], answer: 1 },
            { id: 't4-g3-3', type: 'choice', prompt: 'Ich fahre im Urlaub ___ Wien.', options: ['nach', 'in', 'zum'], answer: 0 },
            { id: 't4-g3-4', type: 'choice', prompt: 'Ich brauche Brot. Ich gehe ___ Bäckerei.', options: ['zum', 'zur', 'nach'], answer: 1 },
            { id: 't4-g3-5', type: 'choice', prompt: 'Kennst du Thomas? – Ja, ich kenne ___ gut.', options: ['er', 'ihn', 'ihm'], answer: 1 },
          ],
        },
      ],
    },
    {
      id: 'schreiben',
      tasks: [
        {
          id: 't4-s1', title: 'Teil 1', instruction: FORM, instructionUz: FORM_UZ,
          texts: [{
            kind: 'note',
            body: 'Ihre Freundin Zarina Qodirova möchte im August eine Radtour am Bodensee machen. Sie ist am 3. Mai 2002 geboren und kommt aus Usbekistan. Sie wohnt in Stuttgart. Sie fährt mit dem Zug zum Bodensee.',
          }],
          items: [
            { id: 't4-s1-1', type: 'form', label: 'Vorname', answer: ['Zarina'] },
            { id: 't4-s1-2', type: 'form', label: 'Geburtsdatum', answer: ['3. Mai 2002', '03. Mai 2002', '03.05.2002', '3.5.2002', '3.05.2002', '03.5.2002', '3. 5. 2002'] },
            { id: 't4-s1-3', type: 'form', label: 'Herkunftsland', answer: ['Usbekistan'] },
            { id: 't4-s1-4', type: 'form', label: 'Wohnort', answer: ['Stuttgart'] },
            { id: 't4-s1-5', type: 'form', label: 'Anreise mit', answer: ['Zug', 'dem Zug', 'mit dem Zug', 'Bahn', 'der Bahn'] },
          ],
        },
        {
          id: 't4-s2', title: 'Teil 2', instruction: WRITE, instructionUz: WRITE_UZ,
          items: [{
            id: 't4-s2-1', type: 'writing',
            prompt: 'Ihr Kollege Markus hat Sie zu seiner Geburtstagsfeier am Samstag eingeladen. Sie können nicht kommen. Schreiben Sie Markus eine E-Mail.',
            promptUz: 'Hamkasbingiz Markus sizni shanba kungi tugʻilgan kun bazmiga taklif qildi. Siz bora olmaysiz. Markusga elektron xat yozing.',
            points: ['Danke für die Einladung', 'Warum können Sie nicht kommen?', 'Ein Vorschlag: Wann treffen Sie sich?'],
            words: 30,
            model: 'Lieber Markus,\nvielen Dank für deine Einladung! Leider kann ich am Samstag nicht kommen. Meine Schwester heiratet und ich fahre nach Samarkand. Hast du nächste Woche Zeit? Wir können am Mittwoch zusammen essen gehen.\nAlles Gute zum Geburtstag!\nSardor',
          }],
        },
      ],
    },
    {
      id: 'sprechen',
      tasks: [
        intro('t4', 'Guten Tag! Mein Name ist Bobur Karimov. Ich bin 30 Jahre alt. Ich komme aus Usbekistan und wohne in Fergana. Ich spreche Usbekisch, Russisch und ein bisschen Deutsch und Englisch. Ich bin Ingenieur. Mein Hobby ist Reisen.'),
        {
          id: 't4-p2', title: 'Teil 2', instruction: 'Thema „Reisen und Wochenende“. Fragen Sie mit jeder Karte und antworten Sie.', instructionUz: SPEAK_2_UZ,
          items: [{
            id: 't4-p2-1', type: 'speaking', part: 2, max: 6,
            prompt: 'Thema: Reisen und Wochenende. Stellen Sie zu jeder Karte eine Frage und antworten Sie.',
            promptUz: 'Mavzu: sayohat va dam olish kunlari. Har bir karta bilan savol bering va unga javob bering.',
            cards: ['Urlaub', 'letztes Wochenende', 'Wetter'],
            model: 'Wohin fährst du im Urlaub? – Im Sommer fahre ich nach Samarkand.\nWas hast du letztes Wochenende gemacht? – Ich habe meine Großeltern besucht.\nWie ist das Wetter heute? – Heute ist es kalt und es regnet.',
          }],
        },
        {
          id: 't4-p3', title: 'Teil 3', instruction: 'Am Bahnhof. Bitten Sie um etwas.', instructionUz: SPEAK_3_UZ,
          items: [{
            id: 't4-p3-1', type: 'speaking', part: 3, max: 6,
            prompt: 'Sie sind am Bahnhof. Bitten Sie höflich um etwas: eine Bitte zu jeder Karte.',
            promptUz: 'Siz vokzaldasiz. Har bir karta boʻyicha xushmuomala iltimos qiling.',
            cards: ['🎫 Fahrkarte', '🕐 Abfahrt', '🧳 Gepäck'],
            model: 'Eine Fahrkarte nach Berlin, bitte.\nWann fährt bitte der nächste Zug nach Berlin?\nKönnen Sie mir bitte mit dem Gepäck helfen?',
          }],
        },
      ],
    },
  ],
};

/* ============================== Final exam: Lektion 1–12 ============================== */

const FINAL: Test = {
  id: 'a1-final',
  course: 'german',
  title: 'Abschlusstest',
  subtitle: 'Lektion 1–12',
  minutes: 75,
  final: true,
  topics: 'Everything from Lektion 1–12, in the format of the Goethe A1 exam (Start Deutsch 1)',
  sections: [
    {
      id: 'hoeren',
      tasks: [
        {
          id: 'f-h1', ...HOEREN_1,
          items: [
            {
              id: 'f-h1-1', type: 'choice', prompt: 'Wie schreibt man den Familiennamen?', options: ['Schmitt', 'Schmidt', 'Schmied'], answer: 1,
              audio: [
                { who: 'b', text: 'Wie ist Ihr Name, bitte?' },
                { who: 'a', text: 'Anna Schmidt.' },
                { who: 'b', text: 'Wie schreibt man das?' },
                { who: 'a', text: 'S, C, H, M, I, D, T. Schmidt mit D und T.' },
              ],
            },
            {
              id: 'f-h1-2', type: 'choice', prompt: 'Wie viel kostet der Tisch?', options: ['45 Euro', '54 Euro', '145 Euro'], answer: 1,
              audio: [
                { who: 'a', text: 'Der Tisch ist schön! Was kostet er?' },
                { who: 'b', text: 'Vierundfünfzig Euro. Er ist im Sonderangebot.' },
              ],
            },
            {
              id: 'f-h1-3', type: 'choice', prompt: 'Wann ist der Mann zu Hause?', options: ['um 18 Uhr', 'um 19:30 Uhr', 'um 20 Uhr'], answer: 2,
              audio: [
                { who: 'b', text: 'Hallo, ich muss heute länger arbeiten. Ich habe noch eine Besprechung bis halb acht.' },
                { who: 'a', text: 'Und wann bist du zu Hause?' },
                { who: 'b', text: 'So um acht.' },
              ],
            },
            {
              id: 'f-h1-4', type: 'choice', prompt: 'Was isst der Mann?', options: ['Fisch mit Reis', 'Huhn mit Pommes', 'Nudeln mit Soße'], answer: 0,
              audio: [
                { who: 'a', text: 'Möchten Sie das Huhn mit Pommes?' },
                { who: 'b', text: 'Nein, danke. Heute esse ich lieber Fisch. Mit Reis, bitte.' },
              ],
            },
            {
              id: 'f-h1-5', type: 'choice', prompt: 'Wohin fährt die Frau?', options: ['nach Köln', 'nach Bonn', 'nach Hamburg'], answer: 1,
              audio: [
                { who: 'a', text: 'Eine Fahrkarte nach Bonn, bitte.' },
                { who: 'b', text: 'Hin und zurück?' },
                { who: 'a', text: 'Nein, nur hin. Muss ich umsteigen?' },
                { who: 'b', text: 'Ja, in Köln.' },
              ],
            },
            {
              id: 'f-h1-6', type: 'choice', prompt: 'Warum war Lisa gestern nicht im Kurs?', options: ['Sie hat gearbeitet.', 'Sie war beim Arzt.', 'Sie war im Urlaub.'], answer: 1,
              audio: [
                { who: 'b', text: 'Lisa, warum warst du gestern nicht im Kurs?' },
                { who: 'a', text: 'Ich war krank und ich war beim Arzt. Heute geht es mir aber besser.' },
              ],
            },
          ],
        },
        {
          id: 'f-h2', title: 'Teil 2',
          instruction: 'Sie hören Durchsagen. Richtig oder falsch? Sie hören jeden Text zweimal.',
          instructionUz: 'Eʼlonlarni eshitasiz. Toʻgʻrimi yoki notoʻgʻri? Har bir matn ikki marta eshittiriladi.',
          items: [
            {
              id: 'f-h2-1', type: 'truefalse', prompt: 'Der Supermarkt ist morgen ab 7 Uhr geöffnet.', answer: true,
              audio: [{ who: 'n', text: 'Liebe Kunden, unser Supermarkt schließt in zehn Minuten. Bitte kommen Sie zur Kasse. Morgen sind wir ab sieben Uhr wieder für Sie da.' }],
            },
            {
              id: 'f-h2-2', type: 'truefalse', prompt: 'Der Zug nach Leipzig kommt pünktlich.', answer: false,
              audio: [{ who: 'n', text: 'Achtung an Gleis vier: Der Regionalexpress nach Leipzig hat heute zwanzig Minuten Verspätung.' }],
            },
            {
              id: 'f-h2-3', type: 'truefalse', prompt: 'Die Fluggäste nach Istanbul gehen zu Ausgang C9.', answer: true,
              audio: [{ who: 'n', text: 'Liebe Fluggäste nach Istanbul: Bitte gehen Sie jetzt zu Ausgang C neun. Ihr Flugzeug ist bereit.' }],
            },
            {
              id: 'f-h2-4', type: 'truefalse', prompt: 'Morgen regnet es im Norden.', answer: false,
              audio: [{ who: 'n', text: 'Und jetzt das Wetter für morgen: Im Norden scheint die Sonne, im Süden regnet es den ganzen Tag. Es wird zwölf bis fünfzehn Grad warm.' }],
            },
          ],
        },
        {
          id: 'f-h3', title: 'Teil 3',
          instruction: 'Sie hören Nachrichten am Telefon. Kreuzen Sie an: a, b oder c. Sie hören jeden Text zweimal.',
          instructionUz: 'Telefondagi xabarlarni eshitasiz. a, b yoki c ni belgilang. Har bir matn ikki marta eshittiriladi.',
          items: [
            {
              id: 'f-h3-1', type: 'choice', prompt: 'Wann soll Herr Yusupov in die Praxis kommen?', options: ['am Dienstag um 9 Uhr', 'am Donnerstag um 9 Uhr', 'am Donnerstag um 10 Uhr'], answer: 1,
              audio: [{ who: 'a', text: 'Guten Tag, Herr Yusupov, hier ist die Praxis Dr. Wagner. Ihr Termin am Dienstag geht leider nicht. Können Sie am Donnerstag um neun Uhr kommen? Bitte rufen Sie uns zurück. Danke!' }],
            },
            {
              id: 'f-h3-2', type: 'choice', prompt: 'Was soll Kamila mitbringen?', options: ['Getränke', 'einen Salat', 'einen Kuchen'], answer: 1,
              audio: [{ who: 'b', text: 'Hallo Kamila, hier ist Felix. Am Samstag feiern wir meinen Geburtstag im Park. Getränke und Kuchen haben wir schon. Bring bitte einen Salat mit! Bis Samstag!' }],
            },
            {
              id: 'f-h3-3', type: 'choice', prompt: 'Wo treffen sich Dilnoza und Paula?', options: ['vor dem Kino', 'im Café', 'am Bahnhof'], answer: 2,
              audio: [{ who: 'a', text: 'Hallo Dilnoza, hier ist Paula. Das Café am Markt ist heute geschlossen. Wir treffen uns um drei am Bahnhof, okay? Dann gehen wir zusammen ins Kino. Tschüss!' }],
            },
          ],
        },
      ],
    },
    {
      id: 'lesen',
      tasks: [
        {
          id: 'f-l1', title: 'Teil 1', instruction: LESEN_RF, instructionUz: LESEN_RF_UZ,
          texts: [{
            kind: 'email',
            title: 'Termin am Montag',
            body: 'Liebe Frau Hoffmann,\n\nvielen Dank für Ihre E-Mail. Ich komme gern am Montag zu Ihnen ins Büro. Leider kann ich nicht um 9 Uhr kommen, denn mein Deutschkurs ist von 8 bis 11 Uhr. Geht es auch um 12 Uhr?\n\nIch habe in Taschkent fünf Jahre als Bürokauffrau gearbeitet. Ich spreche Usbekisch, Russisch, Englisch und ein bisschen Deutsch. Ich lerne seit sechs Monaten Deutsch.\n\nMit freundlichen Grüßen\nGulnora Saidova',
          }],
          items: [
            { id: 'f-l1-1', type: 'truefalse', prompt: 'Gulnora möchte am Montag ins Büro kommen.', answer: true },
            { id: 'f-l1-2', type: 'truefalse', prompt: 'Gulnora hat am Montag um 9 Uhr Zeit.', answer: false },
            { id: 'f-l1-3', type: 'truefalse', prompt: 'Der Deutschkurs ist am Vormittag.', answer: true },
            { id: 'f-l1-4', type: 'truefalse', prompt: 'Gulnora hat in Taschkent als Lehrerin gearbeitet.', answer: false },
            { id: 'f-l1-5', type: 'truefalse', prompt: 'Gulnora lernt seit einem Jahr Deutsch.', answer: false },
          ],
        },
        {
          id: 'f-l2', title: 'Teil 2', instruction: LESEN_AB, instructionUz: LESEN_AB_UZ,
          items: [
            {
              id: 'f-l2-1', type: 'choice', prompt: 'Sie suchen eine kleine Wohnung in der Stadt.',
              options: ['1-Zimmer-Wohnung im Zentrum, 35 m², Küche, Bad, 450 Euro.', 'Großes Haus mit Garten, 5 Zimmer, 20 km von der Stadt, 1.500 Euro.'], answer: 0,
            },
            {
              id: 'f-l2-2', type: 'choice', prompt: 'Sie möchten Ihr altes Fahrrad verkaufen.',
              options: ['Fahrradladen Speiche: Neue Fahrräder ab 299 Euro!', 'Flohmarkt am Sonntag: Hier können Sie alles verkaufen. Ein Tisch kostet 10 Euro.'], answer: 1,
            },
            {
              id: 'f-l2-3', type: 'choice', prompt: 'Sie arbeiten am Tag und möchten am Abend Deutsch lernen.',
              options: ['Volkshochschule: Deutsch A1, Montag und Mittwoch 18:30–20:00 Uhr.', 'Sprachschule Lingua: Deutsch intensiv, Montag bis Freitag 9–13 Uhr.'], answer: 0,
            },
            {
              id: 'f-l2-4', type: 'choice', prompt: 'Ihr Kind ist krank. Es ist Sonntag.',
              options: ['Kinderarzt Dr. Weiß: Sprechzeiten Montag bis Freitag 8–13 Uhr.', 'Kinderärztlicher Notdienst: Samstag und Sonntag 9–21 Uhr, Tel. 116 117.'], answer: 1,
            },
            {
              id: 'f-l2-5', type: 'choice', prompt: 'Sie möchten mit 30 Freunden Geburtstag feiern.',
              options: ['Restaurant Linde: Raum für Feiern bis 40 Personen. Reservierung: 0761 22 33 44.', 'Café Rosa: Frühstück, Kuchen und Kaffee. Täglich 8–18 Uhr.'], answer: 0,
            },
          ],
        },
        {
          id: 'f-l3', title: 'Teil 3', instruction: SIGNS, instructionUz: SIGNS_UZ,
          items: [
            { id: 'f-l3-1', type: 'truefalse', prompt: 'Die Bäckerei ist im August zwei Wochen geschlossen.', answer: true, text: { kind: 'sign', body: 'Bäckerei Müller\nWir machen Urlaub!\nVom 1. bis 14. August geschlossen.' } },
            { id: 'f-l3-2', type: 'truefalse', prompt: 'Sie können sich am Freitag für einen Kurs anmelden.', answer: false, text: { kind: 'sign', body: 'Sprachschule – 2. Stock\nAnmeldung: Raum 204\nMontag bis Donnerstag 9–17 Uhr' } },
            { id: 'f-l3-3', type: 'truefalse', prompt: 'In der Bibliothek darf man Kaffee trinken.', answer: false, text: { kind: 'sign', body: 'Bibliothek\nBitte leise sein!\nEssen und Trinken verboten.' } },
            { id: 'f-l3-4', type: 'truefalse', prompt: 'Heute können Sie zu Dr. Roth gehen.', answer: true, text: { kind: 'sign', body: 'Praxis Dr. Klein\nHeute keine Sprechstunde.\nVertretung: Dr. Roth, Bahnhofstraße 5' } },
            { id: 'f-l3-5', type: 'truefalse', prompt: 'Am Samstag können Sie bis 21 Uhr schwimmen.', answer: false, text: { kind: 'sign', body: 'Schwimmbad – Öffnungszeiten\nMontag bis Freitag 7–21 Uhr\nSamstag und Sonntag 9–18 Uhr' } },
          ],
        },
      ],
    },
    {
      id: 'grammatik',
      tasks: [
        {
          id: 'f-g1', title: 'Verben', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 'f-g1-1', type: 'gap', prompt: 'Woher ___ ihr?', hint: 'kommen', answer: ['kommt'] },
            { id: 'f-g1-2', type: 'gap', prompt: 'Meine Mutter ___ Lehrerin.', hint: 'sein', answer: ['ist'] },
            { id: 'f-g1-3', type: 'gap', prompt: '___ du Geschwister?', hint: 'haben', answer: ['Hast'] },
            { id: 'f-g1-4', type: 'gap', prompt: 'Er ___ gern Fisch.', hint: 'essen', answer: ['isst'] },
            { id: 'f-g1-5', type: 'gap', prompt: 'Wann ___ der Film an?', hint: 'anfangen', answer: ['fängt'] },
            { id: 'f-g1-6', type: 'choice', prompt: '___ Sie mir bitte helfen?', options: ['Können', 'Kannst', 'Kann'], answer: 0 },
            { id: 'f-g1-7', type: 'choice', prompt: 'Rauchen verboten! Sie ___ hier nicht rauchen.', options: ['dürfen', 'müssen', 'möchten'], answer: 0 },
            { id: 'f-g1-8', type: 'choice', prompt: 'Wir ___ gestern im Kino.', options: ['waren', 'hatten', 'sind'], answer: 0 },
            { id: 'f-g1-9', type: 'choice', prompt: 'Ich ___ am Samstag nach Hamburg gefahren.', options: ['bin', 'habe', 'war'], answer: 0 },
            { id: 'f-g1-10', type: 'gap', prompt: 'Was hast du am Wochenende ___?', hint: 'machen', answer: ['gemacht'] },
          ],
        },
        {
          id: 'f-g2', title: 'Artikel, Pronomen und Präpositionen', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 'f-g2-1', type: 'choice', prompt: 'Ich habe ___ Bruder und zwei Schwestern.', options: ['ein', 'einen', 'eine'], answer: 1 },
            { id: 'f-g2-2', type: 'choice', prompt: 'Wir haben ___ Auto.', options: ['keinen', 'kein', 'keine'], answer: 1 },
            { id: 'f-g2-3', type: 'choice', prompt: 'Ist das ___ Handy, Herr Braun?', options: ['dein', 'Ihr', 'du'], answer: 1 },
            { id: 'f-g2-4', type: 'choice', prompt: 'Wo ist Paul? Ich sehe ___ nicht.', options: ['er', 'ihn', 'sein'], answer: 1 },
            { id: 'f-g2-5', type: 'choice', prompt: 'Der Kurs ist ___ Montag ___ 18 Uhr.', options: ['am … um', 'um … am', 'im … am'], answer: 0 },
            { id: 'f-g2-6', type: 'choice', prompt: 'Im Sommer fahren wir ___ Österreich.', options: ['nach', 'in', 'zu'], answer: 0 },
            { id: 'f-g2-7', type: 'choice', prompt: 'Ich bin krank. Ich gehe ___ Arzt.', options: ['zur', 'zum', 'nach'], answer: 1 },
            { id: 'f-g2-8', type: 'choice', prompt: 'Wir fliegen ___ Juli in die Türkei.', options: ['am', 'im', 'um'], answer: 1 },
            { id: 'f-g2-9', type: 'gap', prompt: 'Danke für ___ Einladung!', hint: 'dein', answer: ['deine'] },
          ],
        },
        {
          id: 'f-g3', title: 'Sätze und Wortschatz', instruction: GRAMMATIK, instructionUz: GRAMMATIK_UZ,
          items: [
            { id: 'f-g3-1', type: 'choice', prompt: 'Welcher Satz ist richtig?', options: ['Am Sonntag ich schlafe lange.', 'Am Sonntag schlafe ich lange.', 'Ich am Sonntag schlafe lange.'], answer: 1 },
            { id: 'f-g3-2', type: 'choice', prompt: 'Welcher Satz ist richtig?', options: ['Ich kann sehr gut kochen.', 'Ich kann kochen sehr gut.', 'Ich sehr gut kann kochen.'], answer: 0 },
            { id: 'f-g3-3', type: 'choice', prompt: 'Welcher Satz ist richtig?', options: ['Ich rufe dich morgen an.', 'Ich anrufe dich morgen.', 'Ich rufe an dich morgen.'], answer: 0 },
            { id: 'f-g3-4', type: 'choice', prompt: '8:30 Uhr: Es ist …', options: ['halb acht.', 'halb neun.', 'Viertel nach acht.'], answer: 1 },
            { id: 'f-g3-5', type: 'choice', prompt: 'ein Kind – zwei ___', options: ['Kinds', 'Kinder', 'Kinden'], answer: 1 },
            { id: 'f-g3-6', type: 'choice', prompt: 'Am Ende von einem Telefongespräch sagen Sie:', options: ['Auf Wiedersehen!', 'Auf Wiederhören!', 'Guten Appetit!'], answer: 1 },
            { id: 'f-g3-7', type: 'choice', prompt: 'Ihr Freund hat heute Geburtstag. Sie sagen:', options: ['Gute Besserung!', 'Alles Gute zum Geburtstag!', 'Guten Appetit!'], answer: 1 },
          ],
        },
      ],
    },
    {
      id: 'schreiben',
      tasks: [
        {
          id: 'f-s1', title: 'Teil 1', instruction: FORM, instructionUz: FORM_UZ,
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
          id: 'f-s2', title: 'Teil 2', instruction: WRITE, instructionUz: WRITE_UZ,
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
      id: 'sprechen',
      tasks: [
        intro('f', 'Guten Tag! Ich heiße Kamola Usmonova. Ich bin 23 Jahre alt. Ich komme aus Usbekistan, aus Samarkand. Jetzt wohne ich in Taschkent. Ich spreche Usbekisch, Russisch, Englisch und ein bisschen Deutsch. Ich bin Krankenschwester. In meiner Freizeit lese ich gern und ich gehe spazieren.'),
        {
          id: 'f-p2', title: 'Teil 2', instruction: 'Zwei Themen. Fragen Sie mit jeder Karte und antworten Sie.', instructionUz: SPEAK_2_UZ,
          items: [
            {
              id: 'f-p2-1', type: 'speaking', part: 2, max: 6,
              prompt: 'Thema: Essen und Trinken. Stellen Sie zu jeder Karte eine Frage und antworten Sie.',
              promptUz: 'Mavzu: ovqat va ichimliklar. Har bir karta bilan savol bering va unga javob bering.',
              cards: ['Frühstück', 'Lieblingsessen', 'Restaurant'],
              model: 'Was isst du zum Frühstück? – Ich esse Brot mit Käse und trinke Tee.\nWas ist dein Lieblingsessen? – Mein Lieblingsessen ist Plov.\nGehst du oft ins Restaurant? – Nein, nicht oft. Ich koche lieber zu Hause.',
            },
            {
              id: 'f-p2-2', type: 'speaking', part: 2, max: 6,
              prompt: 'Thema: Freizeit und Feste. Stellen Sie zu jeder Karte eine Frage und antworten Sie.',
              promptUz: 'Mavzu: boʻsh vaqt va bayramlar. Har bir karta bilan savol bering va unga javob bering.',
              cards: ['Hobby', 'Geburtstag', 'Sommer'],
              model: 'Was ist dein Hobby? – Ich spiele gern Tennis.\nWann hast du Geburtstag? – Ich habe am fünften April Geburtstag.\nWas machst du im Sommer? – Im Sommer fahre ich zu meinen Großeltern.',
            },
          ],
        },
        {
          id: 'f-p3', title: 'Teil 3', instruction: 'Bitten Sie höflich um etwas.', instructionUz: SPEAK_3_UZ,
          items: [
            {
              id: 'f-p3-1', type: 'speaking', part: 3, max: 6,
              prompt: 'Sie sind bei Freunden zu Hause. Bitten Sie um etwas: eine Bitte zu jeder Karte.',
              promptUz: 'Siz doʻstlaringiznikida mehmondasiz. Har bir karta boʻyicha iltimos qiling.',
              cards: ['🪟 Fenster', '🥤 Wasser', '🎵 Musik leise'],
              model: 'Kannst du bitte das Fenster aufmachen?\nKann ich bitte ein Glas Wasser haben?\nMach bitte die Musik leise.',
            },
            {
              id: 'f-p3-2', type: 'speaking', part: 3, max: 6,
              prompt: 'Sie sind in einem Geschäft. Bitten Sie die Verkäuferin höflich um etwas: eine Bitte zu jeder Karte.',
              promptUz: 'Siz doʻkondasiz. Sotuvchidan har bir karta boʻyicha xushmuomala iltimos qiling.',
              cards: ['👕 T-Shirt in M', '💳 mit Karte', '🛍️ Tasche'],
              model: 'Haben Sie das T-Shirt bitte auch in M?\nKann ich bitte mit Karte bezahlen?\nKann ich bitte eine Tasche haben?',
            },
          ],
        },
      ],
    },
  ],
};

export const GERMAN_A1_TESTS: Test[] = [TEST_1, TEST_2, TEST_3, TEST_4, FINAL];
