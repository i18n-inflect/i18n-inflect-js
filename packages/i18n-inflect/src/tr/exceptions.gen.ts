/**
 * GENERATED FILE — Turkish stem lexicon. DO NOT EDIT BY HAND.
 *
 * Emitted by data-pipeline/run-turkish.ts from UniMorph tur
 * (https://github.com/unimorph/tur). Data licence: CC BY-SA — see
 * LICENSE-DATA.md.
 *
 * Turkish morphology is phonological almost everywhere, so this file is
 * small by design: it records only which words refuse to voice their final
 * `p ç t k` before a vowel (`top` → `topu`, not *tobu), plus a handful of
 * irregular buffer consonants (`su` → `suyun`).
 *
 *   h — hard: the final consonant does not soften
 *   y — takes a y buffer where n would be expected
 */
import type { TrStemFlags } from "./suffixes.js";

const STEM_DATA = `adalet|h
afiyet|h
ahtapot|h
akçaağaç|h
akrobat|h
alamet|h
alet|h
alt|h
anket|h
asimptot|h
astronot|h
aşiret|h
aşk|h
atlambaç|h
avukat|h
aygıt|h
baharat|h
baht|h
bank|h
başkent|h
bazalt|h
bereket|h
biftekkek|h
bip|h
bisiklet|h
bok|h
bulut|h
bürokrat|h
büst|h
cennet|h
cibiliyet|h
ciklet|h
cinsiyet|h
çap|h
çeç|h
çıt|h
çift|h
çip|h
çöp|h
dehşet|h
deist|h
dinamit|h
disket|h
dut|h
dük|h
ebediyet|h
edat|h
edebiyat|h
ehemmiyet|h
ek|h
ekonomist|h
element|h
emniyet|h
et|h
etiket|h
eziyet|h
fagot|h
feribot|h
fok|h
gaflet|h
glasnost|h
göç|h
göt|h
haç|h
hafriyat|h
halk|h
hasret|h
hedonist|h
heyet|h
hidrat|h
hukuk|h
hükûmet|h
iffet|h
ip|h
iskelet|h
istirahat|h
it|h
jilet|h
kâinat|h
kanat|h
kart|h
kaset|h
kastanyet|h
kat|h
kefalet|h
kek|h
kesyap|h
kıç|h
kıyafet|h
kıyamet|h
kıymet|h
kibrit|h
kip|h
kispet|h
kist|h
klarnet|h
klatrat|h
kloroplast|h
koordinat|h
kot|h
kotanjant|h
kozmonot|h
kravat|h
krep|h
kuvvet|h
külfet|h
kümbet|h
kürk|h
Kürt|h
küvet|h
lezzet|h
lolipop|h
lunapark|h
maç|h
malt|h
malumat|h
masumiyet|h
mazot|h
memleket|h
mesuliyet|h
meşrubat|h
mezuniyet|h
misket|h
muhalefet|h
mukavemet|h
müracaat|h
nefret|h
neşriyat|h
net|h
nihayet|h
not|h
omlet|h
ot|h
özet|h
pandeist|h
panendeist|h
panteist|h
pipet|h
planet|h
pop|h
port|h
prostat|h
prototip|h
psikiyatrist|h
raket|h
robot|h
roket|h
saç|h
salahiyet|h
sanat|h
sandviç|h
sepet|h
sevkiyat|h
sıfat|h
sik|h
sirk|h
start|h
şark|h
şehvet|h
şikayet|h
şikâyet|h
şirket|h
şok|h
şort|h
tabiyet|h
tabut|h
taht|h
takat|h
tanjant|h
tatbik|h
taykonot|h
teğet|h
terapist|h
teşkilat|h
tip|h
top|h
tuvalet|h
vasiyet|h
vaziyet|h
vefat|h
vikipedist|h
vilayet|h
yakantop|h
yakut|h
yanıt|h
yazıt|h
yörekent|h
yüzüncü|y
zahmet|h
ziggurat|h
ziyaret|h
zürriyet|h
`;

/** Words whose final consonant does not soften, and other stem oddities. */
export const STEM_FLAGS: ReadonlyMap<string, TrStemFlags> = new Map(
  STEM_DATA.split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [lemma, spec] = line.split("|") as [string, string];
      const flags: TrStemFlags = {};
      for (const flag of spec.split(",")) {
        if (flag === "h") flags.softens = false;
        else if (flag === "y") flags.bufferY = true;
      }
      return [lemma, flags] as const;
    }),
);
