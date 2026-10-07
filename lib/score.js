// Combine price fit and weather fit into a 0-100 score.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export function weatherScore(w, pref = {}) {
  let s = 1;
  const t = w.avgMaxC;
  if (pref.minTempC != null && t < pref.minTempC) s -= clamp((pref.minTempC - t) / 10) * 0.6;
  if (pref.maxTempC != null && t > pref.maxTempC) s -= clamp((t - pref.maxTempC) / 10) * 0.6;
  if (pref.avoidRain) s -= clamp((w.rainChance ?? w.rainMm * 5) / 100) * 0.4;
  if (pref.wantSun && w.sunHoursPerDay != null) s -= clamp(1 - w.sunHoursPerDay / 8) * 0.3;
  return clamp(s);
}

export function priceScore(total, budgetTotal) {
  if (!budgetTotal) return 0.5;
  if (total <= budgetTotal) return 0.6 + 0.4 * (1 - total / budgetTotal); // under budget is good, cheaper is better
  return clamp(0.6 - (total - budgetTotal) / budgetTotal); // over budget is penalised
}

export function score(option, criteria) {
  const budget = criteria.budgetTotal ?? (criteria.budgetPerPerson ? criteria.budgetPerPerson * criteria.travelers : null);
  const ws = weatherScore(option.weather, criteria.weather);
  const ps = priceScore(option.flight.pricePerPerson * criteria.travelers, budget);
  return { total: Math.round((ws * 0.5 + ps * 0.5) * 100), weather: Math.round(ws * 100), price: Math.round(ps * 100), withinBudget: budget ? option.flight.pricePerPerson * criteria.travelers <= budget : null };
}
