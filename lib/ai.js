// LLM wrapper (DeepSeek or Claude): parse the request, suggest destinations, write the summary.
// LLM provider: "deepseek" or "anthropic". Defaults to whichever key is set (DeepSeek wins if both).
const provider = () => {
  const p = (process.env.LLM_PROVIDER || '').toLowerCase();
  if (p === 'deepseek' || p === 'anthropic') return p;
  return process.env.DEEPSEEK_API_KEY ? 'deepseek' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : null;
};
export const aiEnabled = () => {
  const p = provider();
  return Boolean(p && process.env[p === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'ANTHROPIC_API_KEY']);
};

async function ask(system, user, maxTokens = 2000) {
  if (provider() === 'deepseek') {
    // DeepSeek is OpenAI-compatible: https://api-docs.deepseek.com
    const res = await fetch(`${process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', max_tokens: maxTokens, temperature: 0.3, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`DeepSeek API ${res.status}: ${await res.text()}`);
    return (await res.json()).choices?.[0]?.message?.content ?? '';
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

function extractJson(text) {
  const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) throw new Error('No JSON in model response');
  return JSON.parse(m[0]);
}

export async function parseRequest(prompt, today, homeAirport) {
  const system = `You convert vacation requests into JSON. Today is ${today}. Reply with JSON only:
{"origin":"IATA code (default ${homeAirport})","departDate":"YYYY-MM-DD","returnDate":"YYYY-MM-DD",
"travelers":number,"budgetTotal":number|null,"budgetPerPerson":number|null,"currency":"EUR",
"weather":{"minTempC":number|null,"maxTempC":number|null,"avoidRain":boolean,"wantSun":boolean},
"vibe":"short free text e.g. beach, city trip, hiking","maxFlightHours":number|null,
"places":[strings] (countries, regions or cities the user explicitly wants to travel TO, e.g. ["Albania"]. [] if they named none. Never include the origin),
"flexDays":integer 0-3 (0 = EXACT dates only. Use 0 whenever the user says exact/fixed dates, no flexibility, no wiggle room, or gives specific dates without mentioning flexibility. Use 1-3 only if they say they are flexible),
"scope":"europe"|"worldwide" (default "europe"; worldwide only if the user asks for it or names a non-European place),
"originCoords":{"lat":number,"lon":number,"city":"name"}}
If the year is missing use the next occurrence of that date.`;
  return extractJson(await ask(system, prompt, 800));
}

export async function suggestDestinations(criteria, n = 10) {
  const system = `You are a travel expert. Suggest ${n} diverse destinations (only in Europe unless criteria.scope is "worldwide") with a commercial airport that has scheduled passenger service and typically good low-cost/direct connections from the origin; that plausibly match the traveler's vibe and weather wishes at the given dates and are reachable from the origin within the flight-time limit. JSON array only:
[{"city":"","country":"","iata":"XXX","lat":0,"lon":0,"why":"one short sentence"}]`;
  return extractJson(await ask(system, JSON.stringify(criteria), 2000));
}

export async function summarize(criteria, ranked) {
  const system = `You are a friendly travel advisor. Given the traveler's request and ranked options (flight price per person/total, weather forecast, score), write a concise recommendation: top 3 picks with one or two sentences each on price and weather trade-offs, plus one honest caveat if data is demo/estimated. Plain text, no markdown headers.`;
  return ask(system, JSON.stringify({ criteria, options: ranked.slice(0, 6) }), 900);
}

// For places outside the built-in airport table (e.g. non-European). Returns [{city,country,iata,lat,lon,why}].
export async function resolvePlaces(names) {
  const system = `For each place, give its main commercial airport. JSON array only, skip places you do not know: [{"city":"","country":"","iata":"XXX","lat":0,"lon":0,"why":"one short sentence"}]`;
  const out = extractJson(await ask(system, JSON.stringify(names), 800));
  return (Array.isArray(out) ? out : []).filter((a) => /^[A-Z]{3}$/.test(a?.iata) && Number.isFinite(a.lat) && Number.isFinite(a.lon));
}
