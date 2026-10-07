// Built-in European airport table + matcher, so places the user NAMES are always searched (not left to the AI's picks).
// Row: IATA|City|Country|lat|lon  (first airport per country = main one)
const ROWS = `TIA|Tirana|Albania|41.4147|19.7206
PRN|Pristina|Kosovo|42.5728|21.0358
SKP|Skopje|North Macedonia|41.9616|21.6214
OHD|Ohrid|North Macedonia|41.18|20.74
TGD|Podgorica|Montenegro|42.3594|19.2519
TIV|Tivat|Montenegro|42.4047|18.7233
SJJ|Sarajevo|Bosnia and Herzegovina|43.8246|18.3315
BEG|Belgrade|Serbia|44.8184|20.3091
ZAG|Zagreb|Croatia|45.7429|16.0688
SPU|Split|Croatia|43.5389|16.298
DBV|Dubrovnik|Croatia|42.5614|18.2682
ZAD|Zadar|Croatia|44.1083|15.3467
PUY|Pula|Croatia|44.8935|13.9222
LJU|Ljubljana|Slovenia|46.2237|14.4576
ATH|Athens|Greece|37.9364|23.9445
SKG|Thessaloniki|Greece|40.5197|22.9709
HER|Heraklion|Greece|35.3397|25.1803
CHQ|Chania|Greece|35.5317|24.1497
RHO|Rhodes|Greece|36.4054|28.0862
CFU|Corfu|Greece|39.6019|19.9117
JMK|Mykonos|Greece|37.4351|25.3481
JTR|Santorini|Greece|36.3992|25.4793
ZTH|Zakynthos|Greece|37.7509|20.8843
IST|Istanbul|Turkey|41.2753|28.7519
AYT|Antalya|Turkey|36.8987|30.8005
DLM|Dalaman|Turkey|36.7131|28.7925
BJV|Bodrum|Turkey|37.2506|27.6643
ADB|Izmir|Turkey|38.2924|27.157
LCA|Larnaca|Cyprus|34.8751|33.6249
PFO|Paphos|Cyprus|34.718|32.4857
MLA|Malta|Malta|35.8575|14.4775
MAD|Madrid|Spain|40.4936|-3.5668
BCN|Barcelona|Spain|41.2974|2.0833
AGP|Malaga|Spain|36.6749|-4.4991
VLC|Valencia|Spain|39.4893|-0.4816
SVQ|Seville|Spain|37.418|-5.8931
PMI|Palma|Spain|39.5517|2.7388
IBZ|Ibiza|Spain|38.8729|1.3731
MAH|Menorca|Spain|39.8626|4.2186
ALC|Alicante|Spain|38.2822|-0.5582
BIO|Bilbao|Spain|43.3011|-2.9106
SCQ|Santiago de Compostela|Spain|42.8963|-8.4151
TFS|Tenerife|Spain|28.0445|-16.5725
LPA|Gran Canaria|Spain|27.9319|-15.3866
ACE|Lanzarote|Spain|28.9455|-13.6052
FUE|Fuerteventura|Spain|28.4527|-13.8638
LIS|Lisbon|Portugal|38.7742|-9.1342
OPO|Porto|Portugal|41.2481|-8.6814
FAO|Faro|Portugal|37.0144|-7.9659
FNC|Madeira|Portugal|32.6979|-16.7745
PDL|Ponta Delgada|Portugal|37.7412|-25.6979
CDG|Paris|France|49.0097|2.5479
NCE|Nice|France|43.6584|7.2159
MRS|Marseille|France|43.4393|5.2214
LYS|Lyon|France|45.7256|5.0811
TLS|Toulouse|France|43.6291|1.3638
BOD|Bordeaux|France|44.8283|-0.7156
NTE|Nantes|France|47.1532|-1.6107
FCO|Rome|Italy|41.8003|12.2389
MXP|Milan|Italy|45.63|8.7231
VCE|Venice|Italy|45.5053|12.3519
NAP|Naples|Italy|40.886|14.2908
BLQ|Bologna|Italy|44.5354|11.2887
FLR|Florence|Italy|43.81|11.2051
PSA|Pisa|Italy|43.6839|10.3927
BRI|Bari|Italy|41.1389|16.7606
CTA|Catania|Italy|37.4668|15.0664
PMO|Palermo|Italy|38.176|13.091
CAG|Cagliari|Italy|39.2515|9.0543
OLB|Olbia|Italy|40.8987|9.5176
TRN|Turin|Italy|45.2008|7.6496
VRN|Verona|Italy|45.3957|10.8885
FRA|Frankfurt|Germany|50.0379|8.5622
MUC|Munich|Germany|48.3538|11.7861
BER|Berlin|Germany|52.3667|13.5033
HAM|Hamburg|Germany|53.6304|9.9882
DUS|Dusseldorf|Germany|51.2895|6.7668
CGN|Cologne|Germany|50.8659|7.1427
VIE|Vienna|Austria|48.1103|16.5697
SZG|Salzburg|Austria|47.7933|13.0043
ZRH|Zurich|Switzerland|47.4647|8.5492
GVA|Geneva|Switzerland|46.2381|6.1089
AMS|Amsterdam|Netherlands|52.3105|4.7683
EIN|Eindhoven|Netherlands|51.45|5.3747
LUX|Luxembourg|Luxembourg|49.6233|6.2044
LHR|London|United Kingdom|51.47|-0.4543
MAN|Manchester|United Kingdom|53.3537|-2.275
EDI|Edinburgh|United Kingdom|55.95|-3.3725
GLA|Glasgow|United Kingdom|55.8719|-4.4331
BHX|Birmingham|United Kingdom|52.4539|-1.748
BRS|Bristol|United Kingdom|51.3827|-2.7191
BFS|Belfast|United Kingdom|54.6575|-6.2158
DUB|Dublin|Ireland|53.4264|-6.2499
ORK|Cork|Ireland|51.8413|-8.4911
SNN|Shannon|Ireland|52.702|-8.9248
CPH|Copenhagen|Denmark|55.6181|12.6561
ARN|Stockholm|Sweden|59.6519|17.9186
GOT|Gothenburg|Sweden|57.6628|12.2798
OSL|Oslo|Norway|60.1976|11.1004
BGO|Bergen|Norway|60.2934|5.2181
TOS|Tromso|Norway|69.6833|18.9189
HEL|Helsinki|Finland|60.3172|24.9633
KEF|Reykjavik|Iceland|63.985|-22.6056
RIX|Riga|Latvia|56.9236|23.9711
TLL|Tallinn|Estonia|59.4133|24.8328
VNO|Vilnius|Lithuania|54.6341|25.2858
PRG|Prague|Czechia|50.1008|14.26
BUD|Budapest|Hungary|47.4369|19.2556
WAW|Warsaw|Poland|52.1657|20.9671
KRK|Krakow|Poland|50.0777|19.7848
GDN|Gdansk|Poland|54.3776|18.4662
WRO|Wroclaw|Poland|51.1027|16.8858
BTS|Bratislava|Slovakia|48.1702|17.2127
OTP|Bucharest|Romania|44.5711|26.085
CLJ|Cluj-Napoca|Romania|46.7852|23.6862
SOF|Sofia|Bulgaria|42.6967|23.4114
VAR|Varna|Bulgaria|43.2321|27.8251
BOJ|Burgas|Bulgaria|42.5696|27.5152`;

export const EUROPE = ROWS.split('\n').map((r) => {
  const [iata, city, country, lat, lon] = r.split('|');
  return { iata, city, country, lat: +lat, lon: +lon };
});
const byIata = Object.fromEntries(EUROPE.map((a) => [a.iata, a]));
const pick = (...codes) => codes.map((c) => byIata[c]);

// Alternative names and regions -> airports.
const COUNTRY_ALIASES = { 'czech republic': 'Czechia', turkiye: 'Turkey', uk: 'United Kingdom', 'great britain': 'United Kingdom', britain: 'United Kingdom', england: 'United Kingdom', scotland: 'United Kingdom', holland: 'Netherlands', macedonia: 'North Macedonia', bosnia: 'Bosnia and Herzegovina' };
const REGIONS = {
  'canary islands': pick('TFS', 'LPA', 'ACE', 'FUE'), canaries: pick('TFS', 'LPA', 'ACE', 'FUE'), 'balearic islands': pick('PMI', 'IBZ', 'MAH'), balearics: pick('PMI', 'IBZ', 'MAH'),
  balkans: pick('TIA', 'SKP', 'TGD', 'SJJ', 'BEG', 'ZAG', 'SPU', 'DBV', 'PRN'), 'greek islands': pick('HER', 'RHO', 'CFU', 'JMK', 'JTR'), baltics: pick('RIX', 'TLL', 'VNO'),
  scandinavia: pick('CPH', 'ARN', 'OSL', 'HEL'), nordics: pick('CPH', 'ARN', 'OSL', 'HEL', 'KEF'), algarve: pick('FAO'), crete: pick('HER', 'CHQ'), sicily: pick('CTA', 'PMO'), sardinia: pick('CAG', 'OLB'),
  mallorca: pick('PMI'), majorca: pick('PMI'), azores: pick('PDL'), madeira: pick('FNC'), 'costa del sol': pick('AGP'), 'amalfi coast': pick('NAP'), dalmatia: pick('SPU', 'DBV', 'ZAD'), tuscany: pick('FLR', 'PSA'),
  'gran canaria': pick('LPA'), 'canary island': pick('TFS', 'LPA', 'ACE', 'FUE'), lisboa: pick('LIS'), wien: pick('VIE'), praha: pick('PRG'), milano: pick('MXP'), roma: pick('FCO'), napoli: pick('NAP'), venezia: pick('VCE'),
};
const MAX_PER_COUNTRY = 4;

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const countries = [...new Set(EUROPE.map((a) => a.country))];

/** Resolve a single place name (country, city, region) to airports. Exact-name match only. */
export function resolvePlace(name) {
  const n = norm(name).trim();
  if (!n) return [];
  if (/^[a-z]{3}$/.test(n) && byIata[n.toUpperCase()]) return [byIata[n.toUpperCase()]];
  if (REGIONS[n]) return REGIONS[n];
  const country = countries.find((c) => norm(c) === n) || COUNTRY_ALIASES[n];
  if (country) return EUROPE.filter((a) => a.country === country).slice(0, MAX_PER_COUNTRY);
  return EUROPE.filter((a) => norm(a.city) === n);
}

/**
 * Find places named in free text. Countries/regions match anywhere; city names only after a preposition
 * ("to Nice", "in Split") so "nice weather" or "split the cost" don't count. `exclude` = origin IATA codes.
 */
export function findPlaces(text, exclude = []) {
  const t = ` ${norm(text)} `;
  const found = new Map(); // place label -> airports
  const add = (label, airports) => { if (airports?.length) found.set(label, airports); };
  for (const c of countries) if (new RegExp(`\\b${esc(norm(c))}\\b`).test(t)) add(c, resolvePlace(c));
  for (const [alias] of Object.entries(COUNTRY_ALIASES)) if (new RegExp(`\\b${esc(alias)}\\b`).test(t)) add(alias, resolvePlace(alias));
  for (const r of Object.keys(REGIONS)) if (new RegExp(`\\b${esc(r)}\\b`).test(t)) add(r, REGIONS[r]);
  for (const a of EUROPE) {
    if (new RegExp(`\\b(?:to|in|visit|visiting|near|around|at|trip to|weekend in)\\s+(?:the\\s+)?${esc(norm(a.city))}\\b`).test(t)) add(a.city, [a]);
  }
  // A country match already covers its cities; drop duplicates and the origin airport(s).
  const seen = new Set(exclude.map((e) => e.toUpperCase()));
  const airports = [];
  for (const list of found.values()) for (const a of list) if (!seen.has(a.iata)) { seen.add(a.iata); airports.push(a); }
  return { places: [...found.keys()], airports };
}
