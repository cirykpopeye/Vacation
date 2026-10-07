// Claude wrapper: parse the request, suggest destinations, write the summary.
const KEY = () => process.env.ANTHROPIC_API_KEY;
const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

export const aiEnabled = () => Boolean(KEY());

async function ask(system, user, maxTokens = 2000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY(), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL(), max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
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
"vibe":"short free text e.g. beach, city trip, hiking","maxFlightHours":number|null}
If the year is missing use the next occurrence of that date.`;
  return extractJson(await ask(system, prompt, 800));
}

export async function suggestDestinations(criteria, n = 10) {
  const system = `You are a travel expert. Suggest ${n} diverse destinations with a commercial airport that plausibly match the traveler's vibe and weather wishes at the given dates and are reachable from the origin within the flight-time limit. JSON array only:
[{"city":"","country":"","iata":"XXX","lat":0,"lon":0,"why":"one short sentence"}]`;
  return extractJson(await ask(system, JSON.stringify(criteria), 2000));
}

export async function summarize(criteria, ranked) {
  const system = `You are a friendly travel advisor. Given the traveler's request and ranked options (flight price per person/total, weather forecast, score), write a concise recommendation: top 3 picks with one or two sentences each on price and weather trade-offs, plus one honest caveat if data is demo/estimated. Plain text, no markdown headers.`;
  return ask(system, JSON.stringify({ criteria, options: ranked.slice(0, 6) }), 900);
}
