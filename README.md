# Vacation Finder

Describe a trip (dates, party size, budget, weather/vibe) and get ranked destinations with flight prices and the weather forecast.
Free data sources: Travelpayouts (cached fares), SerpApi Google Flights (live check, 250/month), Open-Meteo (weather), DeepSeek or Claude (understanding + recommendations).

## Run
```
cp .env.example .env   # add your keys
node server.js         # http://localhost:3000
npm test
```
Without keys it still runs, using demo flight prices and a basic text parser.

## API

`POST /api/v1/search` (header `x-api-key: <API_KEY>` when `API_KEY` is set). Interactive spec: `/openapi.json`.

Structured (no AI parsing, predictable, recommended for system-to-system use):
```
curl -X POST localhost:3000/api/v1/search -H 'x-api-key: KEY' -H 'content-type: application/json' -d '{
  "query": { "origin": "BRU", "departDate": "2026-12-04", "returnDate": "2026-12-07", "travelers": 2,
             "budgetTotal": 500, "weather": { "minTempC": 18, "avoidRain": true }, "scope": "europe" },
  "destinations": [ { "iata": "LIS", "city": "Lisbon", "country": "Portugal", "lat": 38.72, "lon": -9.14 } ]
}'
```
`destinations` is optional; without it Claude proposes candidates. Free text instead: `{ "prompt": "9-12 Oct, 2 people, max 500 euro, warm" }`.

Response (v1): `options[]` best first, each with `destination`, `flight` (`pricePerPerson`, `totalPrice`, `verified`, `priceSource`), `weather`, `links` (`booking`, `googleFlights`, `skyscanner`), `score`, `withinBudget`; plus `summary`, `meta` and `warnings`
(`demo_flight_prices`, `flight_prices_cached_unverified`, `ai_disabled_basic_parser`).
Options over budget, or with no flights for the party size, are never returned.
Errors: `{ "error": { "code", "message" } }` with HTTP 400/401/405/413/429/502.

`GET /api/v1/health` is public.

## Notes
- `verified: true` means a live Google Flights price for your party size. Only the top `VERIFY_TOP` options are verified (each uses one SerpApi search).
- Set `API_KEY` before exposing the server, and `CORS_ORIGIN` if your system calls it from a browser.
