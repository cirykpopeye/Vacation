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
  const r = await runSearch({ criteria: { origin: 'BRU', departDate: '2026-12-01', returnDate: '2026-12-04', travelers: 2, budgetTotal: 500, currency: 'EUR', weather: {}, flexDays: 3 } });
  globalThis.fetch = realFetch;
  assert.equal(r.options.length, 0, 'nothing for the exact dates');
  const lis = r.alternatives.find((o) => o.destination.iata === 'LIS');
  assert.ok(lis, 'LIS found on nearby dates, in Additional dates');
  assert.equal(lis.flight.exactDates, false);
  assert.equal(lis.flight.departDate, '2026-12-02');
  const d = Object.fromEntries(r.meta.diagnostics.map((x) => [x.iata, x]));
  assert.equal(d.ATH.status, 'flight_error');
  assert.match(d.ATH.detail, /token rejected/);
  assert.equal(d.BCN.status, 'no_price_data');
});

test('every option has https booking links; provider link preferred, Google Flights fallback', async () => {
  delete process.env.DEEPSEEK_API_KEY; delete process.env.ANTHROPIC_API_KEY; delete process.env.SERPAPI_KEY;
  process.env.TRAVELPAYOUTS_TOKEN = 'x'; process.env.TRAVELPAYOUTS_MARKER = 'm123';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    if (u.host === 'api.travelpayouts.com') {
      const dest = u.searchParams.get('destination');
      if (dest === 'LIS') return { ok: true, json: async () => ({ success: true, data: [{ price: 60, departure_at: '2026-12-01T08:00:00+01:00', return_at: '2026-12-04T18:00:00+01:00', link: '/search/BRU0112LIS0412?t=abc', transfers: 0 }] }) };
      if (dest === 'BCN') return { ok: true, json: async () => ({ success: true, data: [{ price: 70, departure_at: '2026-12-01T08:00:00+01:00', return_at: '2026-12-04T18:00:00+01:00', link: 'javascript:alert(1)', transfers: 0 }] }) };
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    }
    return { ok: true, json: async () => ({ daily: { time: ['2026-12-01'], temperature_2m_max: [20], temperature_2m_min: [12], precipitation_probability_max: [10], precipitation_sum: [0], sunshine_duration: [20000] } }) };
  };
  (await import('./flights.js')).clearFlightCache();
  const { runSearch } = await import('./search.js?v5');
  const r = await runSearch({ criteria: { origin: 'BRU', departDate: '2026-12-01', returnDate: '2026-12-04', travelers: 2, budgetTotal: 500, currency: 'EUR', weather: {} } });
  globalThis.fetch = realFetch;
  delete process.env.TRAVELPAYOUTS_MARKER;
  const lis = r.options.find((o) => o.destination.iata === 'LIS'), bcn = r.options.find((o) => o.destination.iata === 'BCN');
  assert.match(lis.links.booking, /^https:\/\/www\.aviasales\.com\/search\/BRU0112LIS0412.*marker=m123/);
  assert.equal(bcn.links.bookingSource, 'google-flights', 'unsafe provider link rejected');
  for (const o of r.options) {
    for (const k of ['booking', 'googleFlights', 'skyscanner']) assert.match(o.links[k], /^https:\/\//);
    assert.match(o.links.skyscanner, /\/bru\/[a-z]{3}\/261201\/261204\/\?adultsv2=2$/);
  }
});

test('exact dates are the main list; nearby dates only appear separately and only when flexDays > 0', async () => {
  delete process.env.DEEPSEEK_API_KEY; delete process.env.ANTHROPIC_API_KEY; delete process.env.SERPAPI_KEY;
  process.env.TRAVELPAYOUTS_TOKEN = 'x';
  const realFetch = globalThis.fetch;
  const offer = (price, dep, ret) => ({ price, departure_at: `${dep}T08:00:00+01:00`, return_at: `${ret}T18:00:00+01:00`, transfers: 0, link: `/search/${dep}${ret}` });
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    if (u.host === 'api.travelpayouts.com') {
      const dest = u.searchParams.get('destination'), month = u.searchParams.get('departure_at').length === 7;
      if (dest === 'LIS') return { ok: true, json: async () => ({ success: true, data: month ? [offer(40, '2026-12-02', '2026-12-05'), offer(90, '2026-12-01', '2026-12-04')] : [offer(90, '2026-12-01', '2026-12-04')] }) };
      if (dest === 'BCN') return { ok: true, json: async () => ({ success: true, data: month ? [offer(50, '2026-12-03', '2026-12-06')] : [] }) }; // only other dates
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    }
    return { ok: true, json: async () => ({ daily: { time: ['2026-12-01'], temperature_2m_max: [20], temperature_2m_min: [12], precipitation_probability_max: [10], precipitation_sum: [0], sunshine_duration: [20000] } }) };
  };
  const { clearFlightCache } = await import('./flights.js');
  const { runSearch } = await import('./search.js?v6');
  const crit = (flexDays) => ({ origin: 'BRU', departDate: '2026-12-01', returnDate: '2026-12-04', travelers: 2, budgetTotal: 500, currency: 'EUR', weather: {}, flexDays });

  clearFlightCache();
  const strict = await runSearch({ criteria: crit(0) });
  assert.deepEqual(strict.options.map((o) => o.destination.iata), ['LIS']);
  assert.ok(strict.options.every((o) => o.flight.exactDates && o.flight.departDate === '2026-12-01'));
  assert.equal(strict.alternatives.length, 0, 'no wiggle room => no Additional dates');
  assert.equal(strict.options[0].flight.pricePerPerson, 90, 'exact-date fare, not the cheaper nearby one');

  clearFlightCache();
  const flex = await runSearch({ criteria: crit(2) });
  assert.deepEqual(flex.options.map((o) => o.destination.iata), ['LIS'], 'main list is still exact dates only');
  assert.deepEqual(flex.alternatives.map((o) => o.destination.iata).sort(), ['BCN', 'LIS']);
  assert.ok(flex.alternatives.every((o) => !o.flight.exactDates));
  assert.equal(flex.meta.diagnostics.find((d) => d.iata === 'BCN').status, 'only_other_dates');
  globalThis.fetch = realFetch;
});

test('places the user names are always searched, and only those (not the AI/default picks)', async () => {
  for (const k of ['DEEPSEEK_API_KEY', 'ANTHROPIC_API_KEY', 'SERPAPI_KEY', 'TRAVELPAYOUTS_TOKEN']) delete process.env[k];
  process.env.FLIGHT_PROVIDER = 'mock';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ daily: { time: ['2026-12-01'], temperature_2m_max: [20], temperature_2m_min: [12], precipitation_probability_max: [10], precipitation_sum: [0], sunshine_duration: [20000] } }) });
  const { runSearch } = await import('./search.js?v7');
  const crit = { origin: 'BRU', departDate: '2026-12-01', returnDate: '2026-12-04', travelers: 2, currency: 'EUR', weather: {}, flexDays: 0 };

  let r = await runSearch({ prompt: 'We want to fly to Albania from Brussels, 2 people, 1-4 December 2026' });
  assert.deepEqual(r.options.map((o) => o.destination.iata), ['TIA']);
  assert.deepEqual(r.meta.requestedPlaces.matched, ['Albania']);

  r = await runSearch({ criteria: { ...crit, places: ['Crete', 'Montenegro', 'Atlantis'] } });
  assert.deepEqual(r.options.map((o) => o.destination.iata).sort(), ['CHQ', 'HER', 'TGD', 'TIV']);
  assert.deepEqual(r.meta.requestedPlaces.unresolved, ['Atlantis'], 'unknown place reported, not silently ignored');

  r = await runSearch({ prompt: 'nice weather please, we split the cost, 2 people' });
  assert.ok(r.options.length > 3 && r.meta.requestedPlaces.matched.length === 0, 'no false place match; falls back to default candidates');
  globalThis.fetch = realFetch;
  delete process.env.FLIGHT_PROVIDER;
});
