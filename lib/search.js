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

  // Why each destination did or didn't make it (shown to the user when results are empty).
  const diag = new Map(destinations.map((d) => [d.iata, { iata: d.iata, city: d.city, status: 'ok', detail: '' }]));
  const mark = (iata, status, detail = '') => Object.assign(diag.get(iata), { status, detail });

  // Stage 1: cached prices + weather for all candidates.
  const settled = await Promise.all(destinations.map(async (dest) => {
    // Flights and weather fail independently, so one bad API doesn't hide the other's error.
    const [f, w] = await Promise.allSettled([
      discover.discover({ ...flightArgs, dest }),
      getWeather(dest.lat, dest.lon, criteria.departDate, criteria.returnDate),
    ]);
    if (f.status === 'rejected') { mark(dest.iata, 'flight_error', f.reason.message); return null; }
    if (w.status === 'rejected') { mark(dest.iata, 'weather_error', w.reason.message); return null; }
    if (!f.value) { mark(dest.iata, 'no_price_data', 'no fare found for these dates (or nearby)'); return null; }
    const flight = f.value;
    if (criteria.maxFlightHours && flight.durationHours && flight.durationHours > criteria.maxFlightHours) { mark(dest.iata, 'too_long', `${flight.durationHours} h`); return null; }
    return { destination: dest, flight, weather: w.value, distanceKm: Math.round(distanceKm(origin, dest)) };
  }));
  const failures = [...diag.values()].filter((d) => d.status.endsWith('_error')).length;
  let options = settled.filter(Boolean);

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
      if (r.status === 'rejected') { o.flight.verifyError = true; mark(o.destination.iata, 'verify_error', r.reason.message); return; } // keep, flagged as unverified
      if (!r.value.available) { o.drop = true; dropped++; mark(o.destination.iata, 'unavailable', `no flights for ${criteria.travelers} traveler(s)`); return; }
      o.flight = { ...o.flight, ...r.value };
      finish(o);
    });
    options = options.filter((o) => !o.drop);
  }

  // Hard budget filter: never suggest trips over budget.
  const overBudget = budget ? options.filter((o) => o.totalPrice > budget).length : 0;
  if (budget) {
    for (const o of options) if (o.totalPrice > budget) mark(o.destination.iata, 'over_budget', `${o.totalPrice} ${o.flight.currency} for ${criteria.travelers} > budget ${budget}`);
    options = options.filter((o) => o.totalPrice <= budget);
  }
  options.sort((a, b) => b.score.total - a.score.total);

  let summary = null;
  if (ai && options.length) summary = await summarize(criteria, options).catch(() => null);
  return { criteria, origin, options, summary, meta: { aiEnabled: ai, flightProvider: discover.name, liveVerification: Boolean(verify), failures, diagnostics: [...diag.values()], droppedUnavailable: dropped, droppedOverBudget: overBudget } };
}
