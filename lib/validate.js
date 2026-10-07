// Validation/normalisation for the public API. Throws ApiError with a stable code.
export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const bad = (msg) => new ApiError(400, 'invalid_request', msg);
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const num = (v, name, min, max) => {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw bad(`${name} must be a number between ${min} and ${max}`);
  return v;
};

export function validateBody(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw bad('JSON object body required');
  const hasPrompt = typeof b.prompt === 'string' && b.prompt.trim() !== '';
  const hasQuery = b.query && typeof b.query === 'object';
  if (hasPrompt === !!hasQuery) throw bad('provide exactly one of "prompt" (free text) or "query" (structured)');
  if (hasPrompt) {
    if (b.prompt.length > 1000) throw bad('prompt max 1000 characters');
    return { prompt: b.prompt.trim() };
  }
  const q = b.query;
  if (!isDate(q.departDate) || !isDate(q.returnDate)) throw bad('query.departDate and query.returnDate must be YYYY-MM-DD');
  const today = new Date().toISOString().slice(0, 10);
  if (q.departDate < today) throw bad('departDate is in the past');
  if (q.returnDate < q.departDate) throw bad('returnDate must not be before departDate');
  if (!/^[A-Za-z]{3}$/.test(q.origin || '')) throw bad('query.origin must be a 3-letter IATA code');
  const travelers = q.travelers ?? 1;
  if (!Number.isInteger(travelers) || travelers < 1 || travelers > 9) throw bad('query.travelers must be an integer 1-9');
  const w = q.weather || {};
  const criteria = {
    origin: q.origin.toUpperCase(), departDate: q.departDate, returnDate: q.returnDate, travelers,
    budgetTotal: num(q.budgetTotal, 'budgetTotal', 1, 1e6), budgetPerPerson: num(q.budgetPerPerson, 'budgetPerPerson', 1, 1e6),
    currency: /^[A-Za-z]{3}$/.test(q.currency || '') ? q.currency.toUpperCase() : 'EUR',
    weather: { minTempC: num(w.minTempC, 'weather.minTempC', -60, 60), maxTempC: num(w.maxTempC, 'weather.maxTempC', -60, 60), avoidRain: !!w.avoidRain, wantSun: !!w.wantSun },
    vibe: typeof q.vibe === 'string' ? q.vibe.slice(0, 200) : '',
    maxFlightHours: num(q.maxFlightHours, 'maxFlightHours', 0.5, 30),
    scope: q.scope === 'worldwide' ? 'worldwide' : 'europe',
    originCoords: q.originCoords && Number.isFinite(q.originCoords.lat) && Number.isFinite(q.originCoords.lon) ? { lat: q.originCoords.lat, lon: q.originCoords.lon, city: String(q.originCoords.city || '').slice(0, 60) } : undefined,
  };
  let destinations;
  if (b.destinations != null) {
    if (!Array.isArray(b.destinations) || b.destinations.length > 15) throw bad('destinations must be an array of at most 15 items');
    destinations = b.destinations.map((d, i) => {
      if (!d || !/^[A-Za-z]{3}$/.test(d.iata || '') || !Number.isFinite(d.lat) || !Number.isFinite(d.lon)) throw bad(`destinations[${i}] needs iata, lat, lon`);
      return { iata: d.iata.toUpperCase(), city: String(d.city || d.iata).slice(0, 60), country: String(d.country || '').slice(0, 60), lat: d.lat, lon: d.lon, why: String(d.why || '').slice(0, 200) };
    });
  }
  return { criteria, destinations };
}

// Stable public response shape (v1). Internals can change without breaking clients.
export function toV1(r) {
  const budget = r.criteria.budgetTotal ?? (r.criteria.budgetPerPerson ? r.criteria.budgetPerPerson * r.criteria.travelers : null);
  const warnings = [];
  if (r.meta.flightProvider === 'mock') warnings.push('demo_flight_prices');
  if (r.meta.flightProvider !== 'mock' && !r.meta.liveVerification) warnings.push('flight_prices_cached_unverified');
  if (!r.meta.aiEnabled) warnings.push('ai_disabled_basic_parser');
  return {
    version: '1',
    query: { origin: r.origin.iata, departDate: r.criteria.departDate, returnDate: r.criteria.returnDate, travelers: r.criteria.travelers, budgetTotal: budget, currency: r.criteria.currency, weather: r.criteria.weather, scope: r.criteria.scope || 'europe' },
    options: r.options.map((o, i) => ({
      rank: i + 1,
      destination: { iata: o.destination.iata, city: o.destination.city, country: o.destination.country, lat: o.destination.lat, lon: o.destination.lon, why: o.destination.why, distanceKm: o.distanceKm },
      flight: { pricePerPerson: o.flight.pricePerPerson, totalPrice: o.totalPrice, currency: o.flight.currency, stops: o.flight.stops ?? null, airline: o.flight.airline ?? null, durationHours: o.flight.durationHours ?? null, priceSource: o.flight.source, verified: !!o.flight.verified, exactDates: o.flight.exactDates !== false, departDate: o.flight.departDate ?? r.criteria.departDate, returnDate: o.flight.returnDate ?? r.criteria.returnDate, verificationFailed: !!o.flight.verifyError },
      weather: { source: o.weather.source, avgMaxC: o.weather.avgMaxC, avgMinC: o.weather.avgMinC, rainChancePct: o.weather.rainChance, rainMm: o.weather.rainMm, sunHoursPerDay: o.weather.sunHoursPerDay, days: o.weather.days },
      links: o.links,
      score: { total: o.score.total, weather: o.score.weather, price: o.score.price },
      withinBudget: budget ? o.totalPrice <= budget : null,
    })),
    summary: r.summary,
    meta: { droppedUnavailable: r.meta.droppedUnavailable, droppedOverBudget: r.meta.droppedOverBudget, lookupFailures: r.meta.failures, diagnostics: r.meta.diagnostics },
    warnings,
  };
}
