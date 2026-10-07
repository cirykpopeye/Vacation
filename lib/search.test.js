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
