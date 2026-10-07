import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';

const realFetch = globalThis.fetch;
let server, base;
test.before(async () => {
  for (const k of ['ANTHROPIC_API_KEY', 'TRAVELPAYOUTS_TOKEN', 'SERPAPI_KEY']) delete process.env[k];
  process.env.API_KEY = 'secret';
  process.env.RATE_LIMIT_PER_MIN = '9';
  // Stub only external APIs (weather); let calls to our own server through.
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith('http://127.0.0.1')) return realFetch(url, opts);
    return { ok: true, json: async () => ({ daily: { time: ['2026-12-01'], temperature_2m_max: [22], temperature_2m_min: [14], precipitation_probability_max: [10], precipitation_sum: [0], sunshine_duration: [25000] } }) };
  };
  server = createApp();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server.close(); globalThis.fetch = realFetch; });

const post = (body, key = 'secret') => realFetch(`${base}/api/v1/search`, { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}) }, body: JSON.stringify(body) });
const query = { origin: 'bru', departDate: '2026-12-01', returnDate: '2026-12-04', travelers: 2, budgetTotal: 500, weather: { minTempC: 18 } };

test('health is public', async () => { assert.equal((await realFetch(`${base}/api/v1/health`)).status, 200); });
test('rejects missing/wrong key', async () => {
  assert.equal((await post({ query }, null)).status, 401);
  assert.equal((await post({ query }, 'nope')).status, 401);
});
test('rejects invalid input with stable error shape', async () => {
  for (const bad of [{}, { prompt: 'a', query }, { query: { ...query, travelers: 20 } }, { query: { ...query, returnDate: '2026-11-01' } }, { query: { ...query, origin: 'Brussels' } }]) {
    const r = await post(bad);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error.code, 'invalid_request');
  }
});
test('structured query returns v1 shape without AI', async () => {
  const r = await post({ query });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.version, '1');
  assert.equal(j.query.origin, 'BRU');
  assert.ok(j.options.length > 0);
  const o = j.options[0];
  assert.equal(o.rank, 1);
  assert.ok(o.flight.totalPrice <= 500 && o.withinBudget === true);
  assert.ok('iata' in o.destination && 'avgMaxC' in o.weather && 'total' in o.score);
  assert.ok(j.warnings.includes('demo_flight_prices'));
});
test('custom destinations are respected', async () => {
  const j = await (await post({ query, destinations: [{ iata: 'LIS', city: 'Lisbon', lat: 38.7, lon: -9.1 }] })).json();
  assert.deepEqual(j.options.map((o) => o.destination.iata), ['LIS']);
});
test('rate limit kicks in', async () => {
  let last;
  for (let i = 0; i < 10; i++) last = await post({ query });
  assert.equal(last.status, 429);
});

test('query.places restricts the search; invalid places are rejected', async () => {
  process.env.RATE_LIMIT_PER_MIN = '100';
  const ok = await (await post({ query: { ...query, places: ['Albania'] } })).json();
  assert.deepEqual(ok.options.map((o) => o.destination.iata), ['TIA']);
  assert.deepEqual(ok.meta.requestedPlaces.matched, ['Albania']);
  assert.equal((await post({ query: { ...query, places: 'Albania' } })).status, 400);
});
