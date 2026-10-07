// Flight providers. Each returns { pricePerPerson, currency, airline?, stops?, durationHours? } or null.
const rad = (x) => (x * Math.PI) / 180;
export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Demo prices: distance-based with deterministic jitter. NOT real prices.
const mock = {
  name: 'mock',
  async search({ origin, dest, departDate, travelers }) {
    const km = distanceKm(origin, dest);
    let seed = 0;
    for (const c of dest.iata + departDate) seed = (seed * 31 + c.charCodeAt(0)) % 997;
    const daysOut = Math.max(1, (new Date(departDate) - Date.now()) / 864e5);
    const lastMinute = daysOut < 7 ? 1.35 : 1;
    const price = Math.round((45 + km * 0.09) * (0.8 + (seed % 40) / 100) * lastMinute);
    return { pricePerPerson: price, currency: 'EUR', stops: km > 3500 ? 1 : 0, durationHours: +(1 + km / 750).toFixed(1), airline: 'demo', travelers };
  },
};

const amadeus = {
  name: 'amadeus',
  token: null, exp: 0,
  async auth() {
    if (this.token && Date.now() < this.exp) return this.token;
    const base = process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com';
    const res = await fetch(`${base}/v1/security/oauth2/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.AMADEUS_CLIENT_ID, client_secret: process.env.AMADEUS_CLIENT_SECRET }),
    });
    if (!res.ok) throw new Error(`Amadeus auth ${res.status}`);
    const j = await res.json();
    this.token = j.access_token; this.exp = Date.now() + (j.expires_in - 60) * 1000;
    return this.token;
  },
  async search({ origin, dest, departDate, returnDate, travelers, currency }) {
    const base = process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com';
    const q = new URLSearchParams({ originLocationCode: origin.iata, destinationLocationCode: dest.iata, departureDate: departDate, returnDate, adults: String(travelers), currencyCode: currency || 'EUR', max: '5' });
    const res = await fetch(`${base}/v2/shopping/flight-offers?${q}`, { headers: { authorization: `Bearer ${await this.auth()}` } });
    if (!res.ok) return null;
    const offers = (await res.json()).data || [];
    if (!offers.length) return null;
    const best = offers.reduce((a, b) => (+a.price.grandTotal < +b.price.grandTotal ? a : b));
    const seg = best.itineraries[0].segments;
    return { pricePerPerson: Math.round(+best.price.grandTotal / travelers), currency: best.price.currency, stops: seg.length - 1, airline: best.validatingAirlineCodes?.[0], durationHours: null };
  },
};

export function getProvider() {
  const p = (process.env.FLIGHT_PROVIDER || 'mock').toLowerCase();
  if (p === 'amadeus' && process.env.AMADEUS_CLIENT_ID) return amadeus;
  return mock;
}
