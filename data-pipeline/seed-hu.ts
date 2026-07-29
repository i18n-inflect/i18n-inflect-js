/**
 * Hand-curated Hungarian seed entries, merged into the generated lexicon for
 * lemmas the training split does not cover (held-out or absent from
 * UniMorph). Keeps the classic closed classes and the showcase words stable
 * regardless of how the deterministic split falls.
 */

export const SEED_STEM_LINES: string[] = `ág|l
fal|l
fej|l
fog|l
föld|l
fül|l
gyár|l
hal|l
has|l
ház|l
hely|l
hold|l
láb|l
nyak|l
olaj|l
száj|l
tál|l
tárgy|l
tej|l
toll|l
ujj|l
vaj|l
vas|l
váll|l
kéz|s:kez
víz|s:viz
tűz|s:tüz
út|s:ut
kút|s:kut
lúd|s:lud
rúd|s:rud
nyár|s:nyar
sár|s:sar
madár|s:madar
szamár|s:szamar
bogár|s:bogar
kosár|s:kosar
pohár|s:pohar
kenyér|s:kenyer
levél|s:level
tehén|s:tehen
szekér|s:szeker
egér|s:eger
tél|s:tel
dél|s:del
név|s:nev
szél|s:szel
jég|s:jeg
ég|s:eg
nyíl|s:nyil,h:b
híd|s:hid,h:b
ló|v:lov
kő|v:köv
fű|v:füv
hó|v:hav
tó|v:tav
lé|v:lev
mű|v:műv
cső|v:csöv
bokor|f:bokr
cukor|f:cukr
dolog|f:dolg
gödör|f:gödr
majom|f:majm
malom|f:malm
ökör|f:ökr
sarok|f:sark
szobor|f:szobr
terem|f:term
torok|f:tork
tükör|f:tükr
vödör|f:vödr
álom|f:álm
sátor|f:sátr,l`.split("\n");

export const SEED_OVERRIDE_LINES: string[] = `szó|N;ACC;SG|szót
szó|N;NOM;PL|szavak
férfi|N;INS;SG|férfival
férfi|N;DAT;SG|férfinak
férfi|N;NOM;PL|férfiak`.split("\n");
