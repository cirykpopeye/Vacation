import test from 'node:test';
import assert from 'node:assert/strict';

test('pipeline ranks options with stubbed weather', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  globalThis.fetch = async (url) => {
    const lat = Number(new URL(url).searchParams.get('latitude'));
    const t = lat < 40 ? 26 : 14; // southern = warm
    const n = 4;
    return { ok: true, json: async () => ({ daily: {
      time: ['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'],
      temperature_2m_max: Array(n).fill(t), temperature_2m_min: Array(n).fill(t - 8),
      precipitation_probability_max: Array(n).fill(10), precipitation_sum: Array(n).fill(0),
      sunshine_duration: Array(n).fill(8 * 3600) } }) };
  };
  const { runSearch } = await import('./search.js');
  const r = await runSearch('9 October to 12 October, 2 people, max €500, warm and sunny');
  assert.ok(r.options.length > 0);
  assert.ok(r.options[0].weather.avgMaxC >= r.options.at(-1).weather.avgMaxC);
  assert.equal(r.criteria.travelers, 2);
});

test('verification drops unavailable options and over-budget ones', async () => {
  process.env.TRAVELPAYOUTS_TOKEN = 'x';
  process.env.SERPAPI_KEY = 'y';
  process.env.VERIFY_TOP = '8';
  process.env.FLIGHT_PROVIDER = 'auto';
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    if (u.host === 'api.travelpayouts.com') {
      const price = u.searchParams.get('destination') === 'ATH' ? 900 : 80; // ATH way over budget
      return { ok: true, json: async () => ({ data: [{ price, transfers: 0, airline: 'XX', duration_to: 150 }] }) };
    }
    if (u.host === 'serpapi.com') { // PRG has no seats for 2 adults
      return { ok: true, json: async () => (u.searchParams.get('arrival_id') === 'PRG' ? { best_flights: [] } : { best_flights: [{ price: u.searchParams.get('arrival_id') === 'ATH' ? 900 : 90, flights: [{ airline: 'YY' }], layovers: [], total_duration: 160 }] }) };
    }
    return { ok: true, json: async () => ({ daily: { time: ['2026-10-09'], temperature_2m_max: [24], temperature_2m_min: [15], precipitation_probability_max: [5], precipitation_sum: [0], sunshine_duration: [28000] } }) };
  };
  const { runSearch } = await import('./search.js?v2');
  const r = await runSearch('9 October to 12 October, 2 people, max €500, warm and sunny');
  const codes = r.options.map((o) => o.destination.iata);
  assert.ok(!codes.includes('PRG'), 'unavailable dropped');
  assert.ok(!codes.includes('ATH'), 'over budget dropped');
  assert.ok(r.options.length > 0 && r.options.every((o) => o.totalPrice <= 500));
  assert.ok(r.options.filter((o) => o.flight.verified).length > 0);
});
