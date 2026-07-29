/**
 * Interactive showcase. Run from the repo root after `pnpm build`:
 *
 *   node scripts/demo.mjs                        # the full tour
 *   node scripts/demo.mjs "zöld sárkány" sublative   # inflect your own phrase
 *   node scripts/demo.mjs "a 5" accusative           # articles + digits
 */
import { format, inflect, onWarning } from "../packages/i18n-inflect/dist/index.js";
import "../packages/i18n-inflect/dist/hu/index.js";
import "../packages/i18n-inflect/dist/en/index.js";
import "../packages/i18n-inflect/dist/de/index.js";
import "../packages/i18n-inflect/dist/fr/index.js";
import "../packages/i18n-inflect/dist/es/index.js";
import "../packages/i18n-inflect/dist/ko/index.js";

onWarning((w) => console.log(`   ⚠ ${w.code}: ${w.detail}`));

// ---- custom phrase mode: node scripts/demo.mjs <phrase> [case] [plural] ----
const [phrase, caseName, pluralFlag] = process.argv.slice(2);
if (phrase) {
  const features = {};
  if (caseName) features.case = caseName;
  if (pluralFlag === "plural") features.number = "plural";
  console.log(inflect("hu", phrase, features));
  process.exit(0);
}

const show = (label, value) => console.log(`${label.padEnd(46)} → ${value}`);

console.log("\n■ Sablonréteg (a {var} behelyettesítés UTÁN ragoz):\n");
show(
  'hu  "Nyertél ^[a {card}](case: instrumental)!"  card="kőr ász"',
  format("hu", "Nyertél ^[a {card}](case: instrumental)!", { card: "kőr ász" }),
);
show(
  '                                          card="pikk dáma"',
  format("hu", "Nyertél ^[a {card}](case: instrumental)!", { card: "pikk dáma" }),
);
show(
  'hu  "^[a {n}](case: accusative) dobtad"        n="hat"',
  format("hu", "^[a {n}](case: accusative) dobtad", { n: "hat" }),
);
show(
  'en  "You drew ^[a {c}](article: indefinite)"   c="ace"',
  format("en", "You drew ^[a {c}](article: indefinite)", { c: "ace" }),
);
show(
  '                                          c="king"',
  format("en", "You drew ^[a {c}](article: indefinite)", { c: "king" }),
);
show(
  'ko  "^[{app}](case: topic) 최고!"               app="지도"',
  format("ko", "^[{app}](case: topic) 최고!", { app: "지도" }),
);

console.log("\n■ Magyar esetragok — hangrend, tőtípusok, v-hasonulás:\n");
for (const [word, c] of [
  ["ház", "instrumental"], // házzal (hasonulás)
  ["busz", "instrumental"], // busszal (digráf-gemináció)
  ["gyümölcs", "instrumental"], // gyümölccsel
  ["kéz", "accusative"], // kezet (rövidülő tő)
  ["bokor", "accusative"], // bokrot (hangkivető)
  ["ló", "superessive"], // lovon (v-tő)
  ["tükör", "accusative"], // tükröt
  ["híd", "allative"], // hídhoz (hátsó kivétel!)
  ["Budapest", "sublative"], // Budapestre
]) {
  show(`hu  ${word} + ${c}`, inflect("hu", word, { case: c }));
}
show("hu  ház + plural + inessive", inflect("hu", "ház", { number: "plural", case: "inessive" }));

console.log("\n■ a/az kiejtés szerint (szám, betűszó is):\n");
for (const p of ["a alma", "az ház", "a 5-ös", "az 6-os", "a MTA", "az BKV"]) {
  show(`hu  "${p}" (névelő-egyeztetés)`, inflect("hu", p));
}

console.log("\n■ Számok és betűszavak kötőjeles toldalékolása (kiejtés szerint):\n");
for (const [tok, c] of [
  ["6", "accusative"], // hat → hatot → 6-ot
  ["5", "instrumental"], // öt → öttel → 5-tel
  ["1", "instrumental"], // egy → eggyel → 1-gyel
  ["100", "instrumental"], // száz → százzal → 100-zal
  ["1000", "accusative"], // ezer → ezret → 1000-et
  ["10", "accusative"], // tíz → tizet → 10-et
  ["SMS", "accusative"], // es-em-es →
  ["MTA", "inessive"], // em-té-á →
  ["BKV", "instrumental"], // bé-ká-vé →
]) {
  show(`hu  ${tok} + ${c}`, inflect("hu", tok, { case: c }));
}
show("hu  tv + instrumental (lexikonból)", inflect("hu", "tv", { case: "instrumental" }));
show("hu  dkg + instrumental (lexikonból)", inflect("hu", "dkg", { case: "instrumental" }));

console.log("\n■ Német / francia / spanyol egyeztetés:\n");
show(
  'de  "ein rotes Auto" + dative (neuter)',
  inflect("de", "ein rotes Auto", { case: "dative", gender: "neuter" }),
);
show('fr  "le ami" (elízió)', inflect("fr", "le ami"));
show('fr  "le haricot" (h aspiré blokkol)', inflect("fr", "le haricot"));
show("es  agua + definite article", inflect("es", "agua", { article: "definite" }));
show('es  "el agua" + plural', inflect("es", "el agua", { number: "plural" }));

console.log("\n■ Koreai partikulák (batchim szerint):\n");
for (const [w, c] of [
  ["사과", "accusative"],
  ["책", "accusative"],
  ["서울", "instrumental"],
  ["집", "instrumental"],
  ["8", "instrumental"],
  ["Chrome", "accusative"],
]) {
  show(`ko  ${w} + ${c}`, inflect("ko", w, { case: c }));
}

console.log("\n■ Hibatűrés (sosem dob — degradál és warningol):\n");
show("xx (ismeretlen nyelv)", format("xx", "take ^[a sword](case: dative)"));
show("hu, elgépelt jegy", format("hu", "^[a ház](case: tipó)"));
console.log();
