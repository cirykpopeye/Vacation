// Booking/search links. The app never books anything: these open the provider's results for the same trip.
const yymmdd = (d) => d.slice(2).replaceAll('-', '');

export const googleFlightsUrl = ({ origin, dest, departDate, returnDate, travelers }) =>
  'https://www.google.com/travel/flights?' + new URLSearchParams({
    q: `Flights to ${dest.iata} from ${origin.iata} on ${departDate} through ${returnDate} for ${travelers} adult${travelers > 1 ? 's' : ''}`,
  });

export const skyscannerUrl = ({ origin, dest, departDate, returnDate, travelers }) =>
  `https://www.skyscanner.net/transport/flights/${origin.iata.toLowerCase()}/${dest.iata.toLowerCase()}/${yymmdd(departDate)}/${yymmdd(returnDate)}/?adultsv2=${travelers}`;

// Only ever hand https URLs to clients (provider data is external input).
export const safeUrl = (u) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : null);

export function buildLinks({ origin, dest, flight, criteria }) {
  const trip = { origin, dest, departDate: flight.departDate || criteria.departDate, returnDate: flight.returnDate || criteria.returnDate, travelers: criteria.travelers };
  const googleFlights = googleFlightsUrl(trip);
  return { booking: safeUrl(flight.bookingUrl) || googleFlights, bookingSource: safeUrl(flight.bookingUrl) ? flight.source : 'google-flights', googleFlights, skyscanner: skyscannerUrl(trip) };
}
