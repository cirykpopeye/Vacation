import { aiEnabled, parseRequest, suggestDestinations, summarize, resolvePlaces } from './ai.js';
import { findPlaces, resolvePlace } from './destinations.js';
import { fallbackParse, FALLBACK_DESTINATIONS } from './fallbackParser.js';
import { getProviders, distanceKm } from './flights.js';
import { getWeather } from './weather.js';
import { score } from './score.js';
import { lookupAirport } from './airports.js';
import { buildLinks } from './links.js';

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

  // Places the user NAMED always win over the AI's own picks: "flights to Albania" searches Albania (and nothing else).
  const matched = [], unresolved = [], named = new Map();
  const addNamed = (list) => list.forEach((a) => { if (a.iata !== origin.iata) named.set(a.iata, a); });
  if (input.prompt) { const f = findPlaces(input.prompt, [origin.iata]); matched.push(...f.places); addNamed(f.airports); }
  for (const place of criteria.places || []) {
    const r = resolvePlace(place);
    if (r.length) { matched.push(place); addNamed(r); } else if (!matched.some((m) => m.toLowerCase() === String(place).toLowerCase())) unresolved.push(place);
  }
  if (unresolved.length && ai) {
    const extra = await resolvePlaces(unresolved).catch(() => []);
    addNamed(extra);
    for (const a of extra) { const i = unresolved.findIndex((u) => a.city?.toLowerCase().includes(u.toLowerCase()) || a.country?.toLowerCase().includes(u.toLowerCase())); if (i >= 0) { matched.push(unresolved[i]); unresolved.splice(i, 1); } }
  }
  const destinations = input.destinations?.length ? input.destinations
    : named.size ? [...named.values()].slice(0, 12)
    : ai ? await suggestDestinations(criteria) : FALLBACK_DESTINATIONS;
  const { discover, verify } = getProviders();
  const budget = criteria.budgetTotal ?? (criteria.budgetPerPerson ? criteria.budgetPerPerson * criteria.travelers : null);
  const verifyTop = Number(process.env.VERIFY_TOP || 4);

  const flexDays = Math.max(0, Math.min(3, Math.round(criteria.flexDays || 0)));
  criteria.flexDays = flexDays;
  const flightArgs = { origin, departDate: criteria.departDate, returnDate: criteria.returnDate, travelers: criteria.travelers, currency: criteria.currency };

  // Why each destination did or didn't make it (shown to the user when results are empty).
  const diag = new Map(destinations.map((d) => [d.iata, { iata: d.iata, city: d.city, status: 'ok', detail: '' }]));
  const mark = (iata, status, detail = '') => Object.assign(diag.get(iata), { status, detail });

  // Stage 1: cached prices + weather for all candidates. One entry per fare (exact-date fare and/or nearby-date fare).
  const settled = await Promise.all(destinations.map(async (dest) => {
    // Flights and weather fail independently, so one bad API doesn't hide the other's error.
    const [f, w] = await Promise.allSettled([
      discover.discover({ ...flightArgs, dest, flexDays }),
      getWeather(dest.lat, dest.lon, criteria.departDate, criteria.returnDate),
    ]);
    if (f.status === 'rejected') { mark(dest.iata, 'flight_error', f.reason.message); return []; }
    if (w.status === 'rejected') { mark(dest.iata, 'weather_error', w.reason.message); return []; }
    if (!f.value.length) { mark(dest.iata, 'no_price_data', flexDays ? `no fare for these dates or within ${flexDays} day(s)` : 'no fare found for these exact dates'); return []; }
    const fares = f.value.filter((fl) => !(criteria.maxFlightHours && fl.durationHours && fl.durationHours > criteria.maxFlightHours));
    if (!fares.length) { mark(dest.iata, 'too_long', `over ${criteria.maxFlightHours} h`); return []; }
    if (!fares.some((fl) => fl.exactDates)) mark(dest.iata, 'only_other_dates', 'no fare for your exact dates');
    return fares.map((flight) => ({ destination: dest, flight, weather: w.value, distanceKm: Math.round(distanceKm(origin, dest)) }));
  }));
  const failures = [...diag.values()].filter((d) => d.status.endsWith('_error')).length;
  let all = settled.flat();

  const finish = (o) => {
    o.totalPrice = o.flight.pricePerPerson * criteria.travelers;
    o.score = score(o, criteria);
    o.links = buildLinks({ origin, dest: o.destination, flight: o.flight, criteria });
    return o;
  };
  all.forEach(finish);
  const isExact = (o) => o.flight.exactDates !== false;
  const byScore = (a, b) => b.score.total - a.score.total;
  let options = all.filter(isExact).sort(byScore); // exact dates: always the main list
  let alternatives = all.filter((o) => !isExact(o)).sort(byScore); // "Additional dates": separate, never mixed in

  // Stage 2: live check of the best few EXACT-date options for the real party size. No itinerary => unavailable => dropped.
  // (Nearby-date fares are not verified: the live lookup is for the requested dates only.)
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

  // Hard budget filter: never suggest trips over budget (both lists).
  let overBudget = 0;
  if (budget) {
    const within = (o) => {
      if (o.totalPrice <= budget) return true;
      overBudget++;
      if (isExact(o)) mark(o.destination.iata, 'over_budget', `${o.totalPrice} ${o.flight.currency} for ${criteria.travelers} > budget ${budget}`);
      return false;
    };
    options = options.filter(within);
    alternatives = alternatives.filter(within);
  }
  options.sort(byScore);
  alternatives.sort(byScore);

  let summary = null;
  if (ai && options.length) summary = await summarize(criteria, options).catch(() => null);
  return { criteria, origin, options, alternatives, summary, meta: { aiEnabled: ai, flightProvider: discover.name, liveVerification: Boolean(verify), failures, requestedPlaces: { matched: [...new Set(matched)], unresolved }, diagnostics: [...diag.values()], droppedUnavailable: dropped, droppedOverBudget: overBudget } };
}
