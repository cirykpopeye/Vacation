import { existsSync, readFileSync } from 'node:fs';

// Tiny .env loader (no dependencies)
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const { createApp } = await import('./lib/app.js');
const port = process.env.PORT || 3000;
createApp().listen(port, () => {
  console.log(`Vacation finder on http://localhost:${port}`);
  if (!process.env.API_KEY) console.warn('WARNING: API_KEY is not set, /api/v1/search is open to anyone who can reach this server.');
});
