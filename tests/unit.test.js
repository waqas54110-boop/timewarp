const test = require('node:test');
const assert = require('node:assert');
const { validateSelection } = require('../services/timeTravelService');
const { formatYear } = require('../utils/helpers');

test('past/future/present year rules', () => {
  assert.ok(validateSelection({ mode: 'past', year: 1947 }, 2026).ok);
  assert.ok(!validateSelection({ mode: 'past', year: 2026 }, 2026).ok);
  assert.ok(!validateSelection({ mode: 'past', year: -9000 }, 2026).ok);
  assert.ok(validateSelection({ mode: 'future', year: 2150 }, 2026).ok);
  assert.ok(!validateSelection({ mode: 'future', year: 2020 }, 2026).ok);
  assert.ok(validateSelection({ mode: 'present', year: 'ignored' }, 2026).ok);
  assert.ok(!validateSelection({ mode: 'sideways', year: 1947 }, 2026).ok);
  assert.ok(!validateSelection({ mode: 'past', year: 'abc' }, 2026).ok);
  assert.ok(!validateSelection({ mode: 'past', year: 1947, destinationId: 'x' }, 2026).ok);
});

test('formatYear', () => {
  assert.strictEqual(formatYear(-2500), '2500 BCE');
  assert.strictEqual(formatYear(80), '80 CE');
  assert.strictEqual(formatYear(1947), '1947');
});
