/* Basic tests for the SM-2 implementation (JavaScript).

   Run with: `node backEnd/test_spaced_repetition.js`
*/
'use strict';

const assert = require('assert');
const { sm2Update } = require('./spaced_repetition');

function testSm2Basic() {
  const card = { ease_factor: 2.5, repetitions: 0, interval_days: 0 };
  const r1 = sm2Update(card, 5);
  assert.strictEqual(r1.repetitions, 1);
  assert.strictEqual(r1.interval_days, 1);

  // apply and repeat
  card.ease_factor = r1.ease_factor;
  card.repetitions = r1.repetitions;
  card.interval_days = r1.interval_days;

  const r2 = sm2Update(card, 5);
  assert.strictEqual(r2.repetitions, 2);
  assert.strictEqual(r2.interval_days, 6);

  // apply r2
  card.ease_factor = r2.ease_factor;
  card.repetitions = r2.repetitions;
  card.interval_days = r2.interval_days;

  const r3 = sm2Update(card, 5);
  assert.ok(r3.repetitions === 3);
  assert.ok(r3.interval_days >= 6);
}

if (require.main === module) {
  testSm2Basic();
  console.log('sm2 basic tests passed');
}
