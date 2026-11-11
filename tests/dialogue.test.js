const test = require('node:test');
const assert = require('node:assert');
const D = require('../public/js/dialogue.js');
const seeded = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const base = { era: 'present', role: 'citizen', name: 'Ali', year: 2026, yearLabel: '2026', place: 'Lahore', shopNames: ['Cafe', 'Bakery'], items: D.items('Cafe') };
const say = (text, extra = {}) => D.reply({ ...base, ...extra, text }, seeded(1));

test('answers the common questions, in English and Roman Urdu', () => {
  assert.match(say('Hello'), /hello|hi/i);
  assert.match(say('assalam o alaikum'), /./);
  assert.match(say('salam'), /hello|hi|assalam|peace|greetings/i);
  assert.match(say('what year is it?'), /2026/);
  assert.match(say('konsa saal hai'), /2026/);
  assert.match(say('where am I'), /Lahore/);
  assert.match(say('where can I eat'), /Cafe/);
  assert.match(say('kitne ka hai', { role: 'keeper' }), /Rs \d+/);
  assert.match(say('khuda hafiz'), /goodbye|see you|hafiz/i);
  assert.match(say('shukriya'), /welcome|problem|time/i);
  assert.match(say('police ko bulao', { role: 'citizen' }), /police/i);
  assert.match(say('aap ka naam kya hai'), /Ali/);
});

test('era flavour and fallbacks', () => {
  assert.match(say('how is the weather', { era: 'past' }), /market/);
  assert.match(say('tell me about the future', { era: 'future' }), /fly/i);
  assert.match(say('xyzzy blorp'), /did not catch|not sure/i);
  assert.ok(say('').length > 0);
});

test('every shop has a price list and every era has names, chat lines and suggestions', () => {
  for (const n of ['Cafe', 'Bakery', 'Pharmacy', 'Mobile Shop', 'Tailor', 'Grocery', 'Books', 'Barber', 'Halwai', 'Pansari', 'Sarai', 'Hakeem', 'Darzi', 'Chai Khana', 'Kulfa House', 'Sarraf', 'Hover Garage', 'Neon Noodles', 'Robo Repair', 'Data Cafe', 'Holo Mart', 'Sky Pharmacy']) {
    const it = D.items(n); assert.ok(it.length >= 2, n); it.forEach((i) => assert.ok(i.price > 0 && i.name));
  }
  assert.ok(D.items('Unknown Shop').length >= 2);
  for (const e of ['past', 'present', 'future']) { assert.ok(D.chatLines(e).length >= 8); assert.ok(D.nameFor(e, 37)); D.chatLines(e).forEach((l) => assert.ok(l.length <= 40, l)); }
  ['citizen', 'keeper', 'police'].forEach((r) => assert.ok(D.suggestions(r).length >= 4));
});
