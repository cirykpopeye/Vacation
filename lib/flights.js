// Flight data, two stages (all free-tier friendly):
//  1. discover(): cheap, fast, CACHED prices (Travelpayouts / Aviasales Data API) for every candidate.
//  2. verify():   LIVE Google Flights lookup via SerpApi for the top few, for the real party size.
//     If Google returns no itinerary for N adults, the option is treated as unavailable and dropped.
// Neither API exposes raw seat counts; "priced for N adults" is the availability signal we can get for free.
const rad = (x) => (x * Math.PI) / 180;
export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const cache = new Map(); // key -> { exp, value }; protects the 250/month SerpApi quota
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = await fn();
  cache.set(key, { exp: Date.now() + ttlMs, value });
  return value;
}

// ---- Stage 1: discovery ----------------------------------------------------
const travelpayouts = {
  name: 'travelpayouts',
  live: false,
  async discover({ origin, dest, departDate, returnDate, currency }) {
    return cached(`tp:${origin.iata}:${dest.iata}:${departDate}:${returnDate}`, 3600e3, async () => {
      const q = new URLSearchParams({
        origin: origin.iata, destination: dest.iata, departure_at: departDate, return_at: returnDate,
        currency: (currency || 'EUR').toLowerCase(), sorting: 'price', direct: 'false', limit: '1', one_way: 'false',
        token: process.env.TRAVELPAYOUTS_TOKEN,
      });
      const res = await fetch(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${q}`);
      if (!res.ok) throw new Error(`Travelpayouts ${res.status}`);
      const offer = ((await res.json()).data || [])[0];
      if (!offer) return null;
      return { pricePerPerson: Math.round(offer.price), currency: (currency || 'EUR').toUpperCase(), stops: offer.transfers ?? null, airline: offer.airline, durationHours: offer.duration_to ? +(offer.duration_to / 60).toFixed(1) : null, source: 'travelpayouts', verified: false };
    });
  },
};

// Demo prices: distance-based with deterministic jitter. NOT real prices.
const mock = {
  name: 'mock',
  live: false,
  async discover({ origin, dest, departDate }) {
    const km = distanceKm(origin, dest);
    let seed = 0;
    for (const c of dest.iata + departDate) seed = (seed * 31 + c.charCodeAt(0)) % 997;
    const daysOut = Math.max(1, (new Date(departDate) - Date.now()) / 864e5);
    const price = Math.round((45 + km * 0.09) * (0.8 + (seed % 40) / 100) * (daysOut < 7 ? 1.35 : 1));
    return { pricePerPerson: price, currency: 'EUR', stops: km > 3500 ? 1 : 0, durationHours: +(1 + km / 750).toFixed(1), airline: 'demo', source: 'mock', verified: false };
  },
};

// ---- Stage 2: live verification --------------------------------------------
const serpapi = {
  name: 'serpapi',
  async verify({ origin, dest, departDate, returnDate, travelers, currency }) {
    return cached(`sa:${origin.iata}:${dest.iata}:${departDate}:${returnDate}:${travelers}`, 6 * 3600e3, async () => {
      const q = new URLSearchParams({
        engine: 'google_flights', departure_id: origin.iata, arrival_id: dest.iata, outbound_date: departDate, return_date: returnDate,
        adults: String(travelers), currency: (currency || 'EUR').toUpperCase(), hl: 'en', type: '1', api_key: process.env.SERPAPI_KEY,
      });
      const res = await fetch(`https://serpapi.com/search.json?${q}`);
      if (!res.ok) throw new Error(`SerpApi ${res.status}`);
      const j = await res.json();
      const all = [...(j.best_flights || []), ...(j.other_flights || [])].filter((f) => typeof f.price === 'number');
      if (!all.length) return { available: false };
      const best = all.reduce((a, b) => (a.price <= b.price ? a : b));
      // ASSUMPTION: Google's `price` is the per-person fare. Set SERPAPI_PRICE_IS_TOTAL=1 if your first
      // real run shows it is the total for all adults.
      const perPerson = process.env.SERPAPI_PRICE_IS_TOTAL === '1' ? best.price / travelers : best.price;
      return {
        available: true, pricePerPerson: Math.round(perPerson), currency: (currency || 'EUR').toUpperCase(),
        stops: (best.layovers || []).length, airline: best.flights?.[0]?.airline, durationHours: best.total_duration ? +(best.total_duration / 60).toFixed(1) : null,
        source: 'google-flights', verified: true,
      };
    });
  },
};

export function getProviders() {
  const want = (process.env.FLIGHT_PROVIDER || 'auto').toLowerCase();
  const discover = want !== 'mock' && process.env.TRAVELPAYOUTS_TOKEN ? travelpayouts : mock;
  const verify = process.env.SERPAPI_KEY && discover.name !== 'mock' ? serpapi : null;
  return { discover, verify };
}
