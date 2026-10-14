// Built-in word lists (shared lesson words). Each list is added to the database once:
// see SEED_PACKS and src/lib/server/db.ts.
import type { Pos, WordData } from './types';

type SeedRow = [id: string, term: string, meaning: string, pos: Pos, pronunciation: string, forms: string, example: string, exampleTr: string, mnemonic: string, notes: string, tags: string[]];

const LEKTION_3: SeedRow[] = [
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

// Lektion 5 (from the class handout). Meanings follow the handout, with typos and a few clear mistakes fixed.
const LEKTION_5: SeedRow[] = [
  ["l5-uhr", "die Uhr", "soat", "noun", "[uːɐ̯]", "die Uhren", "Die Uhr ist kaputt.", "Soat buzilgan.", "Uhr sounds like “hour”: it tells you the hour.", "Wie viel Uhr ist es? = Soat necha?", ["things"]],
  ["l5-auto", "das Auto", "avtomobil", "noun", "[ˈaʊ̯to]", "die Autos", "Das Auto ist neu.", "Avtomobil yangi.", "Auto is short for Automobil, the same word as avtomobil.", "", ["things"]],
  ["l5-handy", "das Handy", "mobil telefon", "noun", "[ˈhɛndi]", "die Handys", "Mein Handy ist leer.", "Telefonimning quvvati tugadi.", "It fits in your hand: das Handy.", "Looks English, but English says mobile phone. das Telefon is a phone in general.", ["things"]],
  ["l5-zeichnen", "zeichnen", "chizmoq", "verb", "[ˈtsaɪ̯çnən]", "er zeichnet · zeichnete · hat gezeichnet", "Das Kind zeichnet ein Haus.", "Bola uy chizyapti.", "das Zeichen (sign) → zeichnen: to draw signs and pictures.", "", ["verb"]],
  ["l5-buch", "das Buch", "kitob", "noun", "[buːx]", "die Bücher", "Das Buch ist sehr interessant.", "Kitob juda qiziqarli.", "Buch ≈ book.", "", ["things"]],
  ["l5-farbe", "die Farbe", "rang", "noun", "[ˈfaʁbə]", "die Farben", "Welche Farbe hat dein Auto?", "Avtomobilingning rangi qanday?", "Welche Farbe …? = What colour …? Ask it about everything around you.", "", ["colours"]],
  ["l5-sehen", "sehen", "ko’rmoq", "verb", "[ˈzeːən]", "du siehst · er sieht · sah · hat gesehen", "Ich sehe das Auto.", "Men avtomobilni ko’ryapman.", "sehen ≈ see. e → ie with du and er: du siehst, er sieht.", "The h is silent.", ["verb"]],
  ["l5-etwas", "etwas", "nimadir", "pronoun", "[ˈɛtvas]", "", "Möchtest du etwas trinken?", "Biror narsa ichasanmi?", "etwas = something. Also “a little”: etwas Zeit.", "", ["little-words"]],
  ["l5-viele", "viele", "ko’plab, ko’p", "pronoun", "[ˈfiːlə]", "viel · viele", "Ich habe viele Bücher.", "Mening ko’p kitoblarim bor.", "V sounds like F: [ˈfiːlə].", "viele before plurals (viele Bücher), viel before things you can’t count (viel Wasser).", ["little-words"]],
  ["l5-ding", "das Ding", "narsa, buyum", "noun", "[dɪŋ]", "die Dinge", "Was ist das für ein Ding?", "Bu qanaqa narsa?", "Ding ≈ thing: German d is often English th (danke ≈ thank).", "", ["things"]],
  ["l5-und-so-weiter", "und so weiter", "va boshqalar", "phrase", "[ʊnt zoː ˈvaɪ̯tɐ]", "", "Ich kaufe Brot, Milch, Käse und so weiter.", "Men non, sut, pishloq va boshqalarni sotib olaman.", "Written short as usw., like etc.", "", ["phrase"]],
  ["l5-sagen", "sagen", "aytmoq", "verb", "[ˈzaːɡn̩]", "er sagt · sagte · hat gesagt", "Was sagst du?", "Nima deyapsan?", "sagen ≈ say (g ↔ y, like Tag ≈ day).", "", ["verb", "communication"]],
  ["l5-fragen", "fragen", "so’ramoq", "verb", "[ˈfʁaːɡn̩]", "er fragt · fragte · hat gefragt", "Darf ich etwas fragen?", "Bir narsa so’rasam maylimi?", "die Frage (question) → fragen: to ask a question.", "", ["verb", "communication"]],
  ["l5-antworten", "antworten", "javob bermoq", "verb", "[ˈantvɔʁtn̩]", "er antwortet · antwortete · hat geantwortet", "Bitte antworten Sie auf Deutsch.", "Iltimos, nemis tilida javob bering.", "Ant-wort: a word (Wort) that comes back to you.", "The noun: die Antwort = javob.", ["verb", "communication"]],
  ["l5-weiter", "weiter", "yana, davomida", "adverb", "[ˈvaɪ̯tɐ]", "", "Bitte lesen Sie weiter.", "Iltimos, o’qishda davom eting.", "weiter = further, on: Go on!", "Often joined to verbs: weiterlesen, weitermachen = davom ettirmoq.", ["little-words"]],
  ["l5-feuerzeug", "das Feuerzeug", "olov yondirgich, zajigalka", "noun", "[ˈfɔɪ̯ɐˌtsɔɪ̯k]", "die Feuerzeuge", "Hast du ein Feuerzeug?", "Senda zajigalka bormi?", "Feuer (fire) + Zeug (stuff, tool): a fire tool.", "", ["things"]],
  ["l5-geldbeutel", "der Geldbeutel", "hamyon", "noun", "[ˈɡɛltˌbɔɪ̯tl̩]", "die Geldbeutel", "Mein Geldbeutel ist leer.", "Hamyonim bo’sh.", "Geld (money) + Beutel (bag): a money bag.", "Means the same as das Portemonnaie.", ["things"]],
  ["l5-portemonnaie", "das Portemonnaie", "hamyon", "noun", "[pɔʁtmɔˈneː]", "die Portemonnaies", "Ich habe mein Portemonnaie vergessen.", "Hamyonimni unutib qoldim.", "French porte-monnaie: it carries (porte) your money (monnaie).", "Also spelled Portmonee. Means the same as der Geldbeutel.", ["things"]],
  ["l5-taschentuch", "das Taschentuch", "ro’molcha, salfetka", "noun", "[ˈtaʃn̩ˌtuːx]", "die Taschentücher", "Hast du ein Taschentuch für mich?", "Senda men uchun salfetka bormi?", "Tasche (pocket) + Tuch (cloth): a pocket cloth.", "Today usually a paper tissue. A towel is das Handtuch.", ["things"]],
  ["l5-regen", "der Regen", "yomg’ir", "noun", "[ˈʁeːɡn̩]", "", "Morgen kommt Regen.", "Ertaga yomg’ir yog’adi.", "Regen ≈ rain.", "Es regnet. = Yomg’ir yog’yapti.", ["weather"]],
  ["l5-auf-deutsch", "auf Deutsch", "nemischa, nemis tilida", "phrase", "[aʊ̯f ˈdɔɪ̯tʃ]", "", "Wie heißt das auf Deutsch?", "Bu nemischa nima deyiladi?", "auf + a language: auf Englisch, auf Usbekisch, auf Russisch.", "", ["phrase", "language"]],
  ["l5-wort", "das Wort", "so’z", "noun", "[vɔʁt]", "die Wörter", "Wie schreibt man das Wort?", "Bu so’z qanday yoziladi?", "Wort ≈ word.", "Plural die Wörter for single words; die Worte for words said together (a speech).", ["language"]],
  ["l5-nennen", "nennen", "atamoq, nomlamoq", "verb", "[ˈnɛnən]", "er nennt · nannte · hat genannt", "Wir nennen ihn Sascha.", "Biz uni Sasha deb ataymiz.", "nennen ≈ to “name” someone.", "Irregular past: nannte, genannt.", ["verb", "language"]],
  ["l5-bitten", "bitten", "iltimos qilmoq", "verb", "[ˈbɪtn̩]", "er bittet · bat · hat gebeten", "Ich bitte dich um Hilfe.", "Sendan yordam so’rayman.", "bitten is the verb behind the magic word bitte.", "um etwas bitten: um Hilfe bitten = yordam so’ramoq.", ["verb", "communication"]],
  ["l5-bitte", "bitte", "iltimos", "particle", "[ˈbɪtə]", "", "Ein Wasser, bitte.", "Bir suv bering, iltimos.", "bitte = please. Also “you’re welcome” and “pardon?”", "Bitte? with a rising voice = Labbay? / Nima dedingiz?", ["little-words", "communication"]],
  ["l5-noch-einmal-bitte", "noch einmal, bitte", "yana bir marta, iltimos", "phrase", "[nɔx ˈaɪ̯nmaːl ˈbɪtə]", "", "Wie bitte? Noch einmal, bitte.", "Nima dedingiz? Yana bir marta, iltimos.", "ein Mal = one time; noch einmal = one more time.", "", ["phrase", "communication"]],
  ["l5-wie-schreibt-man", "Wie schreibt man …?", "… qanday yoziladi?", "phrase", "[viː ˈʃʁaɪ̯pt man]", "", "Wie schreibt man „Bahnhof“?", "„Bahnhof“ qanday yoziladi?", "man = one, people in general: How does one write …?", "", ["phrase", "language"]],
  ["l5-schreiben", "schreiben", "yozmoq", "verb", "[ˈʃʁaɪ̯bn̩]", "er schreibt · schrieb · hat geschrieben", "Ich schreibe eine E-Mail.", "Men elektron xat yozyapman.", "schreiben ≈ scribe, script.", "", ["verb", "communication"]],
  ["l5-sich-bedanken", "sich bedanken", "minnatdorchilik bildirmoq, rahmat aytmoq", "verb", "[zɪç bəˈdaŋkn̩]", "ich bedanke mich · bedankte sich · hat sich bedankt", "Ich bedanke mich für die Hilfe.", "Yordam uchun rahmat aytaman.", "der Dank (thanks) → sich bedanken: to give thanks.", "With mich / dich / sich: ich bedanke mich, du bedankst dich. bei + the person, für + the thing.", ["verb", "communication"]],
  ["l5-danke-schoen", "danke schön", "katta rahmat", "phrase", "[ˈdaŋkə ʃøːn]", "", "Danke schön für das Buch!", "Kitob uchun katta rahmat!", "danke ≈ thank (d ↔ th again); schön = nice.", "The answer: Bitte schön!", ["phrase", "communication"]],
  ["l5-problem", "das Problem", "muammo", "noun", "[pʁoˈbleːm]", "die Probleme", "Kein Problem!", "Hech qisi yo’q!", "Like English “problem”, with the stress on -BLEM.", "", ["communication"]],
  ["l5-bitte-schoen", "Bitte schön", "arzimaydi", "phrase", "[ˈbɪtə ʃøːn]", "", "Danke schön! – Bitte schön!", "Katta rahmat! – Arzimaydi!", "The answer to danke schön.", "Also said when you hand something over: Marhamat.", ["phrase", "communication"]],
  ["l5-woerterbuch", "das Wörterbuch", "lug’at", "noun", "[ˈvœʁtɐˌbuːx]", "die Wörterbücher", "Ich suche das Wort im Wörterbuch.", "Men so’zni lug’atdan qidiryapman.", "Wörter (words) + Buch (book): a word book.", "", ["language", "things"]],
  ["l5-jacke", "die Jacke", "kurtka", "noun", "[ˈjakə]", "die Jacken", "Die Jacke ist warm.", "Kurtka issiq.", "Jacke ≈ jacket. J sounds like Y.", "", ["clothes"]],
  ["l5-streichholz", "das Streichholz", "gugurt", "noun", "[ˈʃtʁaɪ̯çˌhɔlts]", "die Streichhölzer", "Hast du ein Streichholz?", "Senda gugurt bormi?", "streichen (to stroke) + Holz (wood): wood you strike.", "Means the same as das Zündholz.", ["things"]],
  ["l5-zuendholz", "das Zündholz", "gugurt", "noun", "[ˈtsʏntˌhɔlts]", "die Zündhölzer", "Die Zündhölzer liegen auf dem Tisch.", "Gugurt stol ustida.", "zünden (to light) + Holz (wood).", "Means the same as das Streichholz; more common in Austria and Switzerland.", ["things"]],
  ["l5-buerste", "die Bürste", "cho’tka", "noun", "[ˈbʏʁstə]", "die Bürsten", "Wo ist meine Bürste?", "Cho’tkam qayerda?", "Bürste ≈ brush, bristle.", "die Zahnbürste = tish cho’tkasi.", ["bathroom"]],
  ["l5-seife", "die Seife", "sovun", "noun", "[ˈzaɪ̯fə]", "die Seifen", "Die Seife riecht gut.", "Sovunning hidi yoqimli.", "Seife ≈ soap.", "", ["bathroom"]],
  ["l5-handtuch", "das Handtuch", "sochiq", "noun", "[ˈhantˌtuːx]", "die Handtücher", "Das Handtuch ist nass.", "Sochiq ho’l.", "Hand + Tuch (cloth): a cloth for your hands.", "A towel. A handkerchief is das Taschentuch.", ["bathroom"]],
  ["l5-foehn", "der Föhn", "fen", "noun", "[føːn]", "die Föhne", "Der Föhn ist im Bad.", "Fen hammomda.", "Föhn is also the warm wind in the Alps, which gave the hair dryer its name.", "", ["bathroom"]],
  ["l5-online", "online", "onlayn", "adverb", "[ˈɔnlaɪ̯n]", "", "Ich bestelle das Buch online.", "Men kitobni onlayn buyurtma qilaman.", "Said the English way.", "", ["online"]],
  ["l5-bestellen", "bestellen", "buyurtma bermoq", "verb", "[bəˈʃtɛlən]", "er bestellt · bestellte · hat bestellt", "Ich möchte eine Pizza bestellen.", "Men pitsa buyurtma qilmoqchiman.", "be- + stellen (to place): to place an order.", "The noun: die Bestellung = buyurtma.", ["verb", "online"]],
  ["l5-sonne", "die Sonne", "quyosh", "noun", "[ˈzɔnə]", "die Sonnen", "Die Sonne scheint.", "Quyosh charaqlab turibdi.", "Sonne ≈ sun. In German the sun is feminine: die Sonne.", "", ["weather"]],
  ["l5-sonnenbrille", "die Sonnenbrille", "quyoshdan himoyalovchi ko’zoynak", "noun", "[ˈzɔnənˌbʁɪlə]", "die Sonnenbrillen", "Im Sommer trage ich eine Sonnenbrille.", "Yozda men quyosh ko’zoynagi taqaman.", "Sonne (sun) + Brille (glasses).", "die Brille is one thing in German: eine Brille = bitta ko’zoynak.", ["clothes"]],
  ["l5-dunkel", "dunkel-", "to’q-", "adjective", "[ˈdʊŋkl̩]", "dunkelblau · dunkelgrün · dunkelrot", "Mein Auto ist dunkelblau.", "Avtomobilim to’q ko’k.", "dunkel = dark: dunk the colour in the dark.", "Before a colour: dunkelblau = to’q ko’k. On its own, dunkel = qorong’i.", ["colours"]],
  ["l5-hell", "hell-", "och-", "adjective", "[hɛl]", "hellblau · hellgrün · hellrot", "Die Jacke ist hellgrün.", "Kurtka och yashil.", "hell = light, bright (not English “hell”!).", "Before a colour: hellblau = och ko’k. On its own, hell = yorug’.", ["colours"]],
  ["l5-nummer", "die Nummer", "raqam, son", "noun", "[ˈnʊmɐ]", "die Nummern", "Wie ist deine Telefonnummer?", "Telefon raqaming qanday?", "Nummer ≈ number.", "A number that names something: phone, house, room. For counting, German says die Zahl.", ["forms"]],
  ["l5-kunststoff", "der Kunststoff", "plastik", "noun", "[ˈkʊnstˌʃtɔf]", "die Kunststoffe", "Die Flasche ist aus Kunststoff.", "Butilka plastikdan qilingan.", "Kunst (art, man-made) + Stoff (material): a man-made material.", "Also das Plastik.", ["things"]],
  ["l5-produkt", "das Produkt", "mahsulot", "noun", "[pʁoˈdʊkt]", "die Produkte", "Das Produkt ist sehr gut.", "Mahsulot juda yaxshi.", "Like English “product”, with the stress on -DUKT.", "", ["online"]],
  ["l5-produktname", "der Produktname", "mahsulot nomi", "noun", "[pʁoˈdʊktˌnaːmə]", "die Produktnamen", "Schreiben Sie den Produktnamen in das Formular.", "Mahsulot nomini blankaga yozing.", "das Produkt + der Name → der Produktname: the last part gives the article.", "", ["online"]],
  ["l5-menge", "die Menge", "miqdor", "noun", "[ˈmɛŋə]", "die Mengen", "Welche Menge möchten Sie bestellen?", "Qancha miqdorda buyurtma bermoqchisiz?", "Menge ≈ “many”: how many you want.", "eine Menge = juda ko’p: eine Menge Arbeit.", ["online"]],
  ["l5-formular", "das Formular", "blanka, anketa", "noun", "[fɔʁmuˈlaːɐ̯]", "die Formulare", "Bitte füllen Sie das Formular aus.", "Iltimos, blankani to’ldiring.", "Formular ≈ form, with the stress at the end: -LAR.", "ein Formular ausfüllen = blankani to’ldirmoq.", ["forms"]],
  ["l5-anrede", "die Anrede", "murojaat shakli", "noun", "[ˈanˌʁeːdə]", "die Anreden", "Anrede: Herr oder Frau?", "Murojaat: janob yoki xonim?", "an (to) + reden (to talk): how you talk to someone.", "On a form you choose Herr or Frau. In a letter: Sehr geehrte Frau Kim, …", ["forms"]],
  ["l5-e-mail", "die E-Mail", "elektron xat", "noun", "[ˈiːmeɪ̯l]", "die E-Mails", "Ich schreibe dir eine E-Mail.", "Senga elektron xat yozaman.", "Said the English way.", "die E-Mail-Adresse = elektron pochta manzili.", ["forms", "online"]],
  ["l5-telefon", "das Telefon", "trubkali telefon", "noun", "[ˈteːləfoːn]", "die Telefone", "Das Telefon klingelt.", "Telefon jiringlayapti.", "tele (far) + phon (sound): sound from far away.", "das Telefon is any phone, often the one at home or at work; a mobile is das Handy.", ["things"]],
  ["l5-haus", "das Haus", "uy", "noun", "[haʊ̯s]", "die Häuser", "Das Haus ist groß.", "Uy katta.", "Haus ≈ house.", "zu Hause = uyda; nach Hause = uyga.", ["things"]],
  ["l5-adresse", "die Adresse", "manzil", "noun", "[aˈdʁɛsə]", "die Adressen", "Wie ist Ihre Adresse?", "Manzilingiz qanday?", "Adresse ≈ address, with one d and a final -e.", "", ["forms"]],
  ["l5-unterstrich", "der Unterstrich", "pastki chiziq", "noun", "[ˈʊntɐˌʃtʁɪç]", "die Unterstriche", "Meine E-Mail-Adresse hat einen Unterstrich: anna_kim@web.de.", "Elektron pochta manzilimda pastki chiziq bor: anna_kim@web.de.", "unter (under) + Strich (line): _", "Spelling an address: Punkt (.), Bindestrich (-), Unterstrich (_), ät (@).", ["online"]],
  ["l5-aet", "ät (@)", "kuchukcha (@)", "other", "[ɛt]", "das At-Zeichen", "anna ät web Punkt de = anna@web.de", "anna kuchukcha web nuqta de = anna@web.de", "English “at”, said with a German ä.", "The sign is called das At-Zeichen, or jokingly der Klammeraffe (bracket monkey).", ["online"]],
];

/** One built-in list. `flag` is the settings key that records it was added, so it is added only once. */
export interface SeedPack {
  flag: string;
  deck: string;
  rows: SeedRow[];
}

export const SEED_PACKS: SeedPack[] = [
  { flag: 'seeded', deck: 'Lektion 3', rows: LEKTION_3 }, // the original first-start list
  { flag: 'seeded:lektion-5', deck: 'Lektion 5', rows: LEKTION_5 },
];

export function packWords(pack: SeedPack, now = Date.now()): Record<string, WordData & { id: string }> {
  const words: Record<string, WordData & { id: string }> = {};
  pack.rows.forEach(([id, term, meaning, pos, pronunciation, forms, example, exampleTr, mnemonic, notes, tags], i) => {
    words[id] = { id, term, meaning, pos, pronunciation, forms, example, exampleTr, mnemonic, notes, tags, deck: pack.deck, order: i + 1, createdAt: now + i, updatedAt: now + i };
  });
  return words;
}

/** Every built-in word. */
export function seedWords(now = Date.now()): Record<string, WordData & { id: string }> {
  return Object.assign({}, ...SEED_PACKS.map((pack) => packWords(pack, now)));
}
