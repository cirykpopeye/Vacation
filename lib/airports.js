// Minimal origin airport lookup (extend as needed).
export const AIRPORTS = {
  BRU: { iata: 'BRU', city: 'Brussels', lat: 50.9, lon: 4.48 }, AMS: { iata: 'AMS', city: 'Amsterdam', lat: 52.31, lon: 4.76 },
  ANR: { iata: 'ANR', city: 'Antwerp', lat: 51.19, lon: 4.46 }, CRL: { iata: 'CRL', city: 'Charleroi', lat: 50.46, lon: 4.45 },
  CDG: { iata: 'CDG', city: 'Paris', lat: 49.01, lon: 2.55 }, LHR: { iata: 'LHR', city: 'London', lat: 51.47, lon: -0.45 },
  FRA: { iata: 'FRA', city: 'Frankfurt', lat: 50.04, lon: 8.56 }, DUB: { iata: 'DUB', city: 'Dublin', lat: 53.42, lon: -6.27 },
  MAD: { iata: 'MAD', city: 'Madrid', lat: 40.49, lon: -3.57 }, FCO: { iata: 'FCO', city: 'Rome', lat: 41.8, lon: 12.25 },
  JFK: { iata: 'JFK', city: 'New York', lat: 40.64, lon: -73.78 },
};
export function lookupAirport(code, coords) {
  const known = AIRPORTS[(code || '').toUpperCase()];
  if (known) return known;
  if (code && coords) return { iata: code.toUpperCase(), city: coords.city || code, lat: coords.lat, lon: coords.lon };
  return AIRPORTS.BRU;
}
