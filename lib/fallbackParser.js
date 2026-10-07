// Very basic parser used when no ANTHROPIC_API_KEY is set (demo only).
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
export function fallbackParse(prompt, today, homeAirport) {
  const t = prompt.toLowerCase();
  const year = Number(today.slice(0, 4));
  const dates = [...t.matchAll(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s*)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/g)]
    .map((m) => new Date(Date.UTC(year, MONTHS.indexOf(m[2]), Number(m[1]))));
  const iso = (d) => d.toISOString().slice(0, 10);
  const depart = dates[0] || new Date(Date.now() + 14 * 864e5);
  const ret = dates[1] || new Date(depart.getTime() + 3 * 864e5);
  const travelers = Number((t.match(/(\d+)\s*(?:people|persons|adults|travel)/) || [])[1]) || 1;
  const budget = Number((t.match(/(?:€|eur|\$)\s*(\d+)|(\d+)\s*(?:€|eur|euro)/) || []).slice(1).find(Boolean)) || null;
  const warm = /warm|sun|beach|hot/.test(t);
  return {
    origin: homeAirport, departDate: iso(depart), returnDate: iso(ret), travelers,
    budgetTotal: budget, budgetPerPerson: null, currency: 'EUR',
    weather: { minTempC: warm ? 20 : null, maxTempC: null, avoidRain: /dry|no rain/.test(t), wantSun: warm },
    vibe: prompt.slice(0, 80), maxFlightHours: null,
    flexDays: /flexib|around|\+\/-|±|few days/.test(t) && !/no flex|not flex|exact|no wiggle|fixed/.test(t) ? 2 : 0,
  };
}
export const FALLBACK_DESTINATIONS = [
  { city: 'Lisbon', country: 'Portugal', iata: 'LIS', lat: 38.72, lon: -9.14, why: 'Mild, sunny city break' },
  { city: 'Barcelona', country: 'Spain', iata: 'BCN', lat: 41.39, lon: 2.17, why: 'Beach and city' },
  { city: 'Rome', country: 'Italy', iata: 'FCO', lat: 41.9, lon: 12.5, why: 'Culture and food' },
  { city: 'Athens', country: 'Greece', iata: 'ATH', lat: 37.98, lon: 23.73, why: 'Warm, historic' },
  { city: 'Malaga', country: 'Spain', iata: 'AGP', lat: 36.72, lon: -4.42, why: 'Southern sun' },
  { city: 'Palma', country: 'Spain', iata: 'PMI', lat: 39.57, lon: 2.65, why: 'Island beaches' },
  { city: 'Tenerife', country: 'Spain', iata: 'TFS', lat: 28.04, lon: -16.57, why: 'Warm year-round' },
  { city: 'Prague', country: 'Czechia', iata: 'PRG', lat: 50.1, lon: 14.26, why: 'Cheap, compact city' },
];
