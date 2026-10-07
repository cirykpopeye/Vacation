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
  const r = await runSearch({ prompt: '9 October to 12 October, 2 people, max €500, warm and sunny' });
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
  const r = await runSearch({ prompt: '9 October to 12 October, 2 people, max €500, warm and sunny' });
  const codes = r.options.map((o) => o.destination.iata);
  assert.ok(!codes.includes('PRG'), 'unavailable dropped');
  assert.ok(!codes.includes('ATH'), 'over budget dropped');
  assert.ok(r.options.length > 0 && r.options.every((o) => o.totalPrice <= 500));
  assert.ok(r.options.filter((o) => o.flight.verified).length > 0);
});

test('DeepSeek provider is used when its key is set', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  process.env.DEEPSEEK_API_KEY = 'd';
  for (const k of ['TRAVELPAYOUTS_TOKEN', 'SERPAPI_KEY']) delete process.env[k];
  delete process.env.LLM_PROVIDER;
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push(String(url));
    if (String(url).includes('deepseek')) {
      const sys = JSON.parse(opts.body).messages[0].content;
      const out = sys.includes('convert vacation') || sys.includes('convert') ? { origin: 'BRU', departDate: '2026-12-01', returnDate: '2026-12-04', travelers: 2, budgetTotal: 500, currency: 'EUR', weather: {}, scope: 'europe' }
        : sys.includes('Suggest') ? [{ city: 'Lisbon', country: 'Portugal', iata: 'LIS', lat: 38.7, lon: -9.1, why: 'x' }] : 'Lisbon is a good pick.';
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(out).replace(/^"|"$/g, '') } }] }) };
    }
    return { ok: true, json: async () => ({ daily: { time: ['2026-12-01'], temperature_2m_max: [20], temperature_2m_min: [12], precipitation_probability_max: [10], precipitation_sum: [0], sunshine_duration: [20000] } }) };
  };
  const { runSearch } = await import('./search.js?v3');
  const r = await runSearch({ prompt: 'weekend away' });
  globalThis.fetch = realFetch;
  assert.ok(calls.some((c) => c.startsWith('https://api.deepseek.com/chat/completions')));
  assert.ok(!calls.some((c) => c.includes('anthropic.com')));
  assert.equal(r.options[0].destination.iata, 'LIS');
  assert.equal(r.meta.aiEnabled, true);
});

test('falls back to nearby dates and explains skipped destinations', async () => {
  delete process.env.DEEPSEEK_API_KEY; delete process.env.ANTHROPIC_API_KEY; delete process.env.SERPAPI_KEY;
  process.env.TRAVELPAYOUTS_TOKEN = 'x';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    if (u.host === 'api.travelpayouts.com') {
      const dest = u.searchParams.get('destination');
      if (dest === 'ATH') return { ok: false, status: 401 };
      const monthLevel = u.searchParams.get('departure_at').length === 7;
      if (dest === 'LIS' && monthLevel) return { ok: true, json: async () => ({ success: true, data: [{ price: 60, departure_at: '2026-12-02T08:00:00+01:00', return_at: '2026-12-05T18:00:00+01:00', transfers: 0, airline: 'TP' }] }) };
      return { ok: true, json: async () => ({ success: true, data: [] }) }; // everything else: nothing cached
    }
    return { ok: true, json: async () => ({ daily: { time: ['2026-12-01'], temperature_2m_max: [20], temperature_2m_min: [12], precipitation_probability_max: [10], precipitation_sum: [0], sunshine_duration: [20000] } }) };
  };
  const { runSearch } = await import('./search.js?v4');
  const r = await runSearch({ criteria: { origin: 'BRU', departDate: '2026-12-01', returnDate: '2026-12-04', travelers: 2, budgetTotal: 500, currency: 'EUR', weather: {} } });
  globalThis.fetch = realFetch;
  const lis = r.options.find((o) => o.destination.iata === 'LIS');
  assert.ok(lis, 'LIS found via month fallback');
  assert.equal(lis.flight.exactDates, false);
  assert.equal(lis.flight.departDate, '2026-12-02');
  const d = Object.fromEntries(r.meta.diagnostics.map((x) => [x.iata, x]));
  assert.equal(d.ATH.status, 'flight_error');
  assert.match(d.ATH.detail, /token rejected/);
  assert.equal(d.BCN.status, 'no_price_data');
});
