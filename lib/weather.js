// Open-Meteo daily forecast (free, no key). Forecast covers ~16 days ahead;
// beyond that we fall back to the same dates last year (climate proxy).
const daily = 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunshine_duration';

async function fetchRange(base, lat, lon, start, end) {
  const url = `${base}?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=${daily}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return (await res.json()).daily;
}

const shiftYear = (d, n) => `${Number(d.slice(0, 4)) + n}${d.slice(4)}`;
const avg = (a) => { const v = a.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

export async function getWeather(lat, lon, start, end) {
  const daysAhead = (new Date(end) - Date.now()) / 864e5;
  let d, source = 'forecast';
  if (daysAhead <= 15) {
    d = await fetchRange('https://api.open-meteo.com/v1/forecast', lat, lon, start, end);
  } else {
    source = 'last-year';
    d = await fetchRange('https://archive-api.open-meteo.com/v1/archive', lat, lon, shiftYear(start, -1), shiftYear(end, -1));
  }
  return {
    source,
    avgMaxC: avg(d.temperature_2m_max),
    avgMinC: avg(d.temperature_2m_min),
    rainChance: avg(d.precipitation_probability_max ?? []), // null for archive
    rainMm: d.precipitation_sum.reduce((s, x) => s + (x || 0), 0),
    sunHoursPerDay: avg((d.sunshine_duration || []).map((s) => (s == null ? null : s / 3600))),
    days: d.time.map((t, i) => ({ date: t, max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], rain: d.precipitation_sum[i] })),
  };
}
