import { aiEnabled, parseRequest, suggestDestinations, summarize } from './ai.js';
import { fallbackParse, FALLBACK_DESTINATIONS } from './fallbackParser.js';
import { getProviders, distanceKm } from './flights.js';
import { getWeather } from './weather.js';
import { score } from './score.js';
import { lookupAirport } from './airports.js';

// input: { prompt } (free text, parsed by Claude) or { criteria, destinations? } (already structured, skips parsing).
export async function runSearch(input) {
  const today = new Date().toISOString().slice(0, 10);
  const home = process.env.HOME_AIRPORT || 'BRU';
  const ai = aiEnabled();
  const criteria = input.criteria
    ? input.criteria
    : ai ? await parseRequest(input.prompt, today, home) : fallbackParse(input.prompt, today, home);
  criteria.travelers = criteria.travelers || 1;
  const origin = lookupAirport(criteria.origin, criteria.originCoords);
  const destinations = input.destinations?.length ? input.destinations : ai ? await suggestDestinations(criteria) : FALLBACK_DESTINATIONS;
  const { discover, verify } = getProviders();
  const budget = criteria.budgetTotal ?? (criteria.budgetPerPerson ? criteria.budgetPerPerson * criteria.travelers : null);
  const verifyTop = Number(process.env.VERIFY_TOP || 4);

  const flightArgs = { origin, departDate: criteria.departDate, returnDate: criteria.returnDate, travelers: criteria.travelers, currency: criteria.currency };

  // Stage 1: cached prices + weather for all candidates.
  const settled = await Promise.allSettled(destinations.map(async (dest) => {
    const [flight, weather] = await Promise.all([
      discover.discover({ ...flightArgs, dest }),
      getWeather(dest.lat, dest.lon, criteria.departDate, criteria.returnDate),
    ]);
    if (!flight) return null;
    if (criteria.maxFlightHours && flight.durationHours && flight.durationHours > criteria.maxFlightHours) return null;
    return { destination: dest, flight, weather, distanceKm: Math.round(distanceKm(origin, dest)) };
  }));
  const failures = settled.filter((r) => r.status === 'rejected').length;
  let options = settled.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);

  const finish = (o) => {
    o.totalPrice = o.flight.pricePerPerson * criteria.travelers;
    o.score = score(o, criteria);
    return o;
  };
  options.forEach(finish);
  options.sort((a, b) => b.score.total - a.score.total);

  // Stage 2: live check of the best few for the real party size. No itinerary => unavailable => dropped.
  let dropped = 0;
  if (verify) {
    const top = options.slice(0, verifyTop);
    const checked = await Promise.allSettled(top.map((o) => verify.verify({ ...flightArgs, dest: o.destination })));
    top.forEach((o, i) => {
      const r = checked[i];
      if (r.status === 'rejected') { o.flight.verifyError = true; return; } // keep, flagged as unverified
      if (!r.value.available) { o.drop = true; dropped++; return; }
      o.flight = { ...o.flight, ...r.value };
      finish(o);
    });
    options = options.filter((o) => !o.drop);
  }

  // Hard budget filter: never suggest trips over budget.
  const overBudget = budget ? options.filter((o) => o.totalPrice > budget).length : 0;
  if (budget) options = options.filter((o) => o.totalPrice <= budget);
  options.sort((a, b) => b.score.total - a.score.total);

  let summary = null;
  if (ai && options.length) summary = await summarize(criteria, options).catch(() => null);
  return { criteria, origin, options, summary, meta: { aiEnabled: ai, flightProvider: discover.name, liveVerification: Boolean(verify), failures, droppedUnavailable: dropped, droppedOverBudget: overBudget } };
}
