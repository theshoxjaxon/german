// Lektion 3 word list, loaded into data/store.json the first time the app starts.
import type { Pos, WordData } from './types';

type SeedRow = [id: string, term: string, meaning: string, pos: Pos, pronunciation: string, forms: string, example: string, exampleTr: string, mnemonic: string, notes: string, tags: string[]];

const ROWS: SeedRow[] = [
  ["l3-familie", "die Familie", "oila", "noun", "[faˈmiːli̯ə]", "die Familien", "Meine Familie wohnt in Samarkand.", "Mening oilam Samarqandda yashaydi.", "Sounds like English “family”, with the stress on -MI-.", "", ["family"]],
  ["l3-mutter", "die Mutter", "ona", "noun", "[ˈmʊtɐ]", "die Mütter", "Meine Mutter ist Ärztin.", "Onam shifokor.", "Mutter ≈ mother: swap the “th” for “tt”.", "", ["family"]],
  ["l3-vater", "der Vater", "ota", "noun", "[ˈfaːtɐ]", "die Väter", "Mein Vater arbeitet als Ingenieur.", "Otam muhandis bo’lib ishlaydi.", "German V sounds like F, so Vater sounds like “father”.", "", ["family"]],
  ["l3-schwester", "die Schwester", "opa", "noun", "[ˈʃvɛstɐ]", "die Schwestern", "Meine Schwester studiert in Berlin.", "Opam Berlinda o’qiydi.", "Schwester ≈ sister with an extra “schw-” in front.", "Schwester covers both opa (older) and singil (younger). To be exact: ältere / jüngere Schwester.", ["family"]],
  ["l3-ich-glaube", "Ich glaube", "men ishonamanki …", "phrase", "[ɪç ˈɡlaʊ̯bə]", "", "Ich glaube, das ist mein Onkel.", "Menimcha, bu mening amakim.", "Ich glaube, … = I think / I believe. Use it to give an opinion.", "", ["phrase"]],
  ["l3-glauben", "glauben", "ishonmoq", "verb", "[ˈɡlaʊ̯bn̩]", "er glaubt · glaubte · hat geglaubt", "Das kann ich nicht glauben!", "Bunga ishona olmayman!", "glauben and English “believe” grew from the same old root (-lauben ≈ -lieve).", "", ["verb"]],
  ["l3-onkel", "der Onkel", "amaki , tog’a", "noun", "[ˈɔŋkl̩]", "die Onkel", "Mein Onkel wohnt in Taschkent.", "Amakim Toshkentda yashaydi.", "Onkel = uncle. One German word covers both amaki and tog’a.", "", ["family"]],
  ["l3-oma", "die Oma", "buvi", "noun", "[ˈoːma]", "die Omas", "Meine Oma kocht sehr gut.", "Buvim juda mazali ovqat pishiradi.", "Oma and Opa: grandma and grandpa.", "Formal word: die Großmutter.", ["family"]],
  ["l3-dein", "dein", "sening", "pronoun", "[daɪ̯n]", "dein · deine · dein", "Ist das dein Bruder?", "Bu sening akangmi?", "dein goes with du. The formal “your” is Ihr.", "Use deine before die-words: deine Mutter, deine Schwester.", ["little-words"]],
  ["l3-enkelkind", "das Enkelkind", "nabira", "noun", "[ˈɛŋkl̩ˌkɪnt]", "die Enkelkinder", "Die Oma hat fünf Enkelkinder.", "Buvining beshta nabirasi bor.", "Enkel + Kind (child): the child of your child.", "", ["family"]],
  ["l3-verwandter", "der Verwandte", "erkak qarindoshlar", "noun", "[fɛɐ̯ˈvantə]", "ein Verwandter · die Verwandten", "Er ist ein Verwandter von mir.", "U mening qarindoshim.", "It ends like an adjective: der Verwandte, but ein Verwandter.", "Declines like an adjective. The plural is die Verwandten for everyone.", ["family"]],
  ["l3-verwandte", "die Verwandte", "ayol qarindoshlar", "noun", "[fɛɐ̯ˈvantə]", "eine Verwandte · die Verwandten", "Sie ist eine Verwandte von Maria.", "U Mariyaning qarindoshi.", "Same word as der Verwandte. Only the article tells you it is a woman.", "", ["family"]],
  ["l3-tante", "die Tante", "xola", "noun", "[ˈtantə]", "die Tanten", "Meine Tante hat zwei Kinder.", "Xolamning ikki farzandi bor.", "Tante = aunt (the same word as French tante). It covers xola and amma.", "", ["family"]],
  ["l3-planen", "planen", "rejalashtirmoq", "verb", "[ˈplaːnən]", "er plant · plante · hat geplant", "Wir planen ein Fest.", "Biz bayram rejalashtiryapmiz.", "planen = to plan. A regular verb with no surprises.", "", ["verb", "party"]],
  ["l3-fest", "das Fest", "bayram", "noun", "[fɛst]", "die Feste", "Das Fest ist am Samstag.", "Bayram shanba kuni.", "Fest ≈ festival or feast.", "", ["party"]],
  ["l3-liste", "die Liste", "ro’yxat", "noun", "[ˈlɪstə]", "die Listen", "Wir schreiben eine Liste für das Fest.", "Biz bayram uchun ro’yxat yozyapmiz.", "Liste = list, plus a final -e.", "", ["party"]],
  ["l3-nein", "nein", "yo’q", "particle", "[naɪ̯n]", "", "Nein, ich komme nicht aus Polen.", "Yo’q, men Polshadan emasman.", "nein rhymes with dein and mein.", "", ["little-words"]],
  ["l3-doch", "doch", "aksincha", "particle", "[dɔx]", "", "Kommst du nicht? – Doch, ich komme!", "Kelmaysanmi? – Kelaman-ku!", "The “yes” that contradicts a negative question: Kommst du nicht? – Doch!", "Answer with doch, not ja, when the question has nicht or kein.", ["little-words"]],
  ["l3-polen", "Polen", "Polsha", "noun", "[ˈpoːlən]", "", "Mein Onkel kommt aus Polen.", "Amakim Polshadan kelgan.", "Polen → Polnisch, the Polish language.", "No article for the country. A Polish man is ein Pole, a Polish woman eine Polin.", ["countries"]],
  ["l3-mann", "der Mann", "erkak", "noun", "[man]", "die Männer", "Das ist Anna und ihr Mann Peter.", "Bu Anna va uning eri Peter.", "Mann = man, and also husband: mein Mann = erim.", "", ["family"]],
  ["l3-mitglied", "das Mitglied", "a’zo , qatnashuvchi", "noun", "[ˈmɪtˌɡliːt]", "die Mitglieder", "Ich bin Mitglied im Sportverein.", "Men sport klubining a’zosiman.", "mit (with) + Glied (limb): a limb of the group.", "", ["people"]],
  ["l3-welche-sprache", "Welche Sprache sprichst du?", "Qaysi tillarni bilasan ?", "phrase", "[ˈvɛlçə ˈʃpʁaːxə ʃpʁɪçst duː]", "Welche Sprachen sprichst du?", "Welche Sprache sprichst du? – Ich spreche Usbekisch und Russisch.", "Qaysi tillarni bilasan? – Men o’zbek va rus tillarini bilaman.", "sprichst: sprechen changes e → i with du and er.", "", ["phrase", "language"]],
  ["l3-welche", "welche", "qaysi", "pronoun", "[ˈvɛlçə]", "welcher · welche · welches", "Welche Farbe magst du?", "Qaysi rangni yoqtirasan?", "welcher / welche / welches follow der / die / das.", "", ["little-words"]],
  ["l3-sprache", "die Sprache", "til", "noun", "[ˈʃpʁaːxə]", "die Sprachen", "Deutsch ist eine schöne Sprache.", "Nemis tili — chiroyli til.", "sprechen → Sprache: the thing you speak.", "", ["language"]],
  ["l3-sprechen", "sprechen", "gapirmoq", "verb", "[ˈʃpʁɛçn̩]", "du sprichst · er spricht · sprach · hat gesprochen", "Ich spreche Usbekisch, Russisch und ein bisschen Deutsch.", "Men o’zbek, rus va biroz nemis tilida gaplashaman.", "e → i in the present: ich spreche, du sprichst, er spricht.", "", ["verb", "language"]],
  ["l3-ein-bisschen", "ein bisschen", "biroz", "phrase", "[aɪ̯n ˈbɪsçən]", "", "Warte ein bisschen!", "Biroz kut!", "Biss = bite. ein bisschen is “a little bite”: a bit.", "", ["little-words"]],
  ["l3-gar-nicht", "gar nicht", "umuman", "phrase", "[ɡaːɐ̯ ˈnɪçt]", "", "Das ist gar nicht schwer.", "Bu umuman qiyin emas.", "gar makes nicht stronger: not at all.", "Always negative: gar nicht = umuman … emas.", ["little-words"]],
  ["l3-master", "der Master", "usta", "noun", "[ˈmaːstɐ]", "die Master", "Er macht einen Master in Informatik.", "U informatika bo’yicha magistraturada o’qiydi.", "Think of a Master’s degree: einen Master machen.", "In everyday German der Master usually means a Master’s degree (magistratura). A master craftsman (usta) is der Meister.", ["work"]],
  ["l3-freut-mich", "freut mich", "mamnunman", "phrase", "[fʁɔɪ̯t mɪç]", "", "Ich bin Sardor. – Freut mich!", "Men Sardorman. – Tanishganimdan xursandman!", "Short for “Es freut mich”: it gives me joy (die Freude).", "Formal version: Freut mich, Sie kennenzulernen.", ["phrase"]],
  ["l3-interessant", "interessant", "qiziqarli", "adjective", "[ɪntəʁɛˈsant]", "", "Der Film ist sehr interessant.", "Film juda qiziqarli.", "The stress is at the end: inte-res-SANT.", "", ["describing"]],
  ["l3-it-trainer", "der IT-Trainer", "IT mutaxasisi", "noun", "[aɪ̯ˈtiː ˌtʁɛːnɐ]", "die IT-Trainer · die IT-Trainerin", "Herr Weber ist IT-Trainer.", "Janob Veber — IT mutaxassisi.", "Trainer is said the English way: TRAY-ner.", "No article before a job: Er ist IT-Trainer.", ["work"]],
  ["l3-visitenkarte", "die Visitenkarte", "tashrif qog’ozi", "noun", "[viˈziːtn̩ˌkaʁtə]", "die Visitenkarten", "Hier ist meine Visitenkarte.", "Mana mening tashrif qog’ozim.", "Visite (visit) + Karte (card): a visiting card.", "", ["work"]],
  ["l3-personalabteilung", "die Personalabteilung", "kadrlar bo’limi", "noun", "[pɛʁzoˈnaːlˌʔaptaɪ̯lʊŋ]", "die Personalabteilungen", "Frau Kim arbeitet in der Personalabteilung.", "Kim xonim kadrlar bo’limida ishlaydi.", "Personal (staff) + Abteilung (department). Every -ung word is die.", "", ["work"]],
  ["l3-marketingabteilung", "die Marketingabteilung", "reklama bo’limi", "noun", "[ˈmaʁkətɪŋˌʔaptaɪ̯lʊŋ]", "die Marketingabteilungen", "Die Marketingabteilung ist im dritten Stock.", "Reklama bo’limi uchinchi qavatda.", "The last part decides the article: die Abteilung → die Marketingabteilung.", "", ["work"]],
];

export function seedWords(now = Date.now()): Record<string, WordData & { id: string }> {
  const words: Record<string, WordData & { id: string }> = {};
  ROWS.forEach(([id, term, meaning, pos, pronunciation, forms, example, exampleTr, mnemonic, notes, tags], i) => {
    words[id] = { id, term, meaning, pos, pronunciation, forms, example, exampleTr, mnemonic, notes, tags, deck: 'Lektion 3', order: i + 1, createdAt: now + i, updatedAt: now + i };
  });
  return words;
}
