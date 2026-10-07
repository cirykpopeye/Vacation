import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherScore, priceScore } from './score.js';
test('warm destination scores higher when warmth wanted', () => {
  const pref = { minTempC: 22 };
  assert.ok(weatherScore({ avgMaxC: 26, rainMm: 0 }, pref) > weatherScore({ avgMaxC: 12, rainMm: 0 }, pref));
});
test('under budget beats over budget', () => {
  assert.ok(priceScore(300, 500) > priceScore(700, 500));
});
