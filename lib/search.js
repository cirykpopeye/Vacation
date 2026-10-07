import { aiEnabled, parseRequest, suggestDestinations, summarize } from './ai.js';
import { fallbackParse, FALLBACK_DESTINATIONS } from './fallbackParser.js';
import { getProvider, distanceKm } from './flights.js';
import { getWeather } from './weather.js';
import { score } from './score.js';
import { lookupAirport } from './airports.js';

export async function runSearch(prompt) {
  const today = new Date().toISOString().slice(0, 10);
  const home = process.env.HOME_AIRPORT || 'BRU';
  const ai = aiEnabled();
  const criteria = ai ? await parseRequest(prompt, today, home) : fallbackParse(prompt, today, home);
  criteria.travelers = criteria.travelers || 1;
  const origin = lookupAirport(criteria.origin);
  const destinations = ai ? await suggestDestinations(criteria) : FALLBACK_DESTINATIONS;
  const provider = getProvider();

  const settled = await Promise.allSettled(destinations.map(async (dest) => {
    const [flight, weather] = await Promise.all([
      provider.search({ origin, dest, departDate: criteria.departDate, returnDate: criteria.returnDate, travelers: criteria.travelers, currency: criteria.currency }),
      getWeather(dest.lat, dest.lon, criteria.departDate, criteria.returnDate),
    ]);
    if (!flight) return null;
    const opt = { destination: dest, flight, weather, distanceKm: Math.round(distanceKm(origin, dest)) };
    if (criteria.maxFlightHours && flight.durationHours && flight.durationHours > criteria.maxFlightHours) return null;
    opt.score = score(opt, criteria);
    opt.totalPrice = flight.pricePerPerson * criteria.travelers;
    return opt;
  }));
  const options = settled.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value).sort((a, b) => b.score.total - a.score.total);
  const failures = settled.filter((r) => r.status === 'rejected').length;

  let summary = null;
  if (ai && options.length) summary = await summarize(criteria, options).catch(() => null);
  return { criteria, origin, options, summary, meta: { aiEnabled: ai, flightProvider: provider.name, failures } };
}
