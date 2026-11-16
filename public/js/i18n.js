// Language switch for the screens around Life Mode: Urdu (اردو), Roman Urdu and English.
// Elements marked data-i18n="key" (text), data-i18n-ph="key" (placeholder) or data-i18n-title="key" change with the language.
// Honest limit: the story events and choices inside Life Mode are written in Roman Urdu only; the buttons, labels and the whole "Meri Duniya" page follow the language.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpI18n = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LANGS = { ur: 'اردو', rm: 'Roman Urdu', en: 'English' };
  const D = {
    'saved.life': { ur: 'محفوظ کی ہوئی زندگی', rm: 'Save ki hui zindagi', en: 'Saved life' },
    'continue': { ur: 'جاری رکھیں', rm: 'Continue', en: 'Continue' },
    'newlife': { ur: 'نئی زندگی', rm: 'New Life', en: 'New Life' },
    'life.title': { ur: 'لائف موڈ', rm: 'Life Mode', en: 'Life Mode' },
    'life.lead': { ur: 'بچپن سے بڑھاپے تک ایک پوری زندگی: ہسپتال میں پیدائش، بچپن، اسکول اور میٹرک، کالج، کیریئر، شادی، خاندان اور ریٹائرمنٹ۔ ہر فیصلہ آپ کی زندگی بدلتا ہے۔', rm: 'Baby se budhape tak ek poori zindagi: hospital mein janam, bachpan, school aur matric, college, career, shadi, family aur retirement. Har faisla aap ki zindagi badalta hai.', en: 'A whole life from baby to old age: birth in hospital, childhood, school and matric, college, career, marriage, family and retirement. Every decision changes your life.' },
    'life.name': { ur: 'آپ کا نام', rm: 'Aap ka naam', en: 'Your name' },
    'life.name.ph': { ur: 'مثلاً: علی', rm: 'Jaise: Ali', en: 'For example: Ali' },
    'life.era': { ur: 'کس زمانے میں پیدا ہونا ہے؟', rm: 'Kis zamane mein paida hona hai?', en: 'Which era are you born in?' },
    'era.present': { ur: 'حال (آج کا زمانہ)', rm: 'Present (aaj ka zamana)', en: 'Present (today)' },
    'era.past': { ur: 'ماضی (پرانا زمانہ)', rm: 'Past (purana zamana)', en: 'Past (long ago)' },
    'era.future': { ur: 'مستقبل (2050)', rm: 'Future (2050)', en: 'Future (2050)' },
    'life.dream': { ur: 'آپ کا خواب', rm: 'Aap ka khwab', en: 'Your dream' },
    'dream.none': { ur: 'ابھی کوئی نہیں', rm: 'Abhi koi nahi', en: 'None yet' },
    'life.start': { ur: 'زندگی شروع کریں', rm: 'Zindagi shuru karo', en: 'Start life' },
    'life.perks': { ur: 'ٹائم مشین کے اپ گریڈ جو آپ کے پاس ہیں:', rm: 'Time Machine ke upgrades jo aap ke paas hain:', en: 'Time Machine upgrades you own:' },
    'life.world': { ur: 'میری دنیا', rm: 'Meri Duniya', en: 'My World' },
    'age.unit': { ur: 'سال', rm: 'saal', en: 'years' },
    'life.movie.mid': { ur: '🎬 اب تک کی لائف مووی', rm: '🎬 Ab tak ki Life Movie', en: '🎬 Life Movie so far' },
    'life.restart': { ur: 'نئی زندگی', rm: 'Naya jeevan', en: 'New life' },
    'life.next': { ur: 'اگلا سال ←', rm: 'Agla saal →', en: 'Next year →' },
    'life.money': { ur: 'پیسہ:', rm: 'Paisa:', en: 'Money:' },
    'life.job': { ur: 'پیشہ:', rm: 'Peshah:', en: 'Job:' },
    'life.diary': { ur: 'زندگی کی ڈائری', rm: 'Zindagi ki diary', en: 'Diary of your life' },
    'end.summary': { ur: 'زندگی کا خلاصہ', rm: 'Zindagi ka khulasa', en: 'Summary of your life' },
    'end.state': { ur: 'حالات', rm: 'Haalat', en: 'Condition' },
    'end.virtues': { ur: 'آپ کی خوبیاں', rm: 'Aap ki khoobiyan', en: 'Your virtues' },
    'end.memories': { ur: 'یادوں کا سفر', rm: 'Yaadon ka safar', en: 'Journey of memories' },
    'end.movie': { ur: '🎬 میری لائف مووی دیکھیں', rm: '🎬 Meri Life Movie dekho', en: '🎬 Watch my Life Movie' },
    'end.restart': { ur: 'نئی زندگی شروع کریں', rm: 'Naya jeevan shuru karo', en: 'Start a new life' },
    // Meri Duniya page
    'me.title': { ur: 'میری دنیا', rm: 'Meri Duniya', en: 'My World' },
    'me.lead': { ur: 'آپ کی زندگی کا گھر، خاندان، ڈائری، خواب اور ٹائم مشین ایک جگہ۔', rm: 'Aap ki zindagi ka ghar, khandaan, diary, khwab aur Time Machine ek jagah.', en: 'Your life’s home, family, diary, dreams and Time Machine in one place.' },
    'me.nolife': { ur: 'ابھی کوئی زندگی محفوظ نہیں۔ پہلے لائف موڈ میں زندگی شروع کریں۔', rm: 'Abhi koi zindagi save nahi. Pehle Life Mode mein zindagi shuru karein.', en: 'No saved life yet. Start a life in Life Mode first.' },
    'tab.home': { ur: 'گھر اور سامان', rm: 'Ghar aur saman', en: 'Home & things' },
    'tab.family': { ur: 'خاندان', rm: 'Khandaan', en: 'Family tree' },
    'tab.diary': { ur: 'ڈائری', rm: 'Diary', en: 'Diary' },
    'tab.dreams': { ur: 'خواب اور مقصد', rm: 'Khwab aur maqsad', en: 'Dreams & goals' },
    'tab.capsule': { ur: 'ٹائم کیپسول', rm: 'Time Capsule', en: 'Time Capsule' },
    'tab.butterfly': { ur: 'تتلی کا اثر', rm: 'Butterfly Effect', en: 'Butterfly Effect' },
    'tab.machine': { ur: 'ٹائم مشین', rm: 'Time Machine', en: 'Time Machine' },
    'tab.board': { ur: 'لیڈر بورڈ', rm: 'Leaderboard', en: 'Leaderboard' },
    'tab.settings': { ur: 'سیٹنگز', rm: 'Settings', en: 'Settings' },
    'home.current': { ur: 'آپ کا گھر', rm: 'Aap ka ghar', en: 'Your home' },
    'home.upgrade': { ur: 'گھر بدلیں', rm: 'Ghar badlein', en: 'Move to a better home' },
    'home.things': { ur: 'سامان', rm: 'Saman', en: 'Things' },
    'home.pets': { ur: 'پالتو جانور', rm: 'Pets', en: 'Pets' },
    'buy': { ur: 'خریدیں', rm: 'Khareedein', en: 'Buy' },
    'sell': { ur: 'بیچیں', rm: 'Bechein', en: 'Sell' },
    'adopt': { ur: 'پالیں', rm: 'Palein', en: 'Adopt' },
    'owned': { ur: 'آپ کے پاس ہے', rm: 'Aap ke paas hai', en: 'Owned' },
    'diary.add': { ur: 'آج کی بات لکھیں', rm: 'Aaj ki baat likhein', en: 'Write today’s note' },
    'save': { ur: 'محفوظ کریں', rm: 'Save karein', en: 'Save' },
    'capsule.text': { ur: 'اپنے آپ کے نام خط', rm: 'Apne aap ke naam khat', en: 'A letter to your future self' },
    'capsule.years': { ur: 'کتنے سال بعد کھلے؟', rm: 'Kitne saal baad khule?', en: 'Open after how many years?' },
    'capsule.seal': { ur: 'خط بند کریں', rm: 'Khat band karein', en: 'Seal the letter' },
    'butterfly.lead': { ur: 'ایک فیصلہ بدلیں اور دیکھیں زندگی کتنی بدلتی ہے۔', rm: 'Ek faisla badlein aur dekhein zindagi kitni badalti hai.', en: 'Change one decision and see how much life changes.' },
    'butterfly.try': { ur: 'یہ آزمائیں', rm: 'Ye azmayein', en: 'Try this' },
    'machine.points': { ur: 'ٹائم مشین پوائنٹس', rm: 'Time Machine points', en: 'Time Machine points' },
    'machine.claim': { ur: 'مکمل زندگی کے پوائنٹس لیں', rm: 'Mukammal zindagi ke points lein', en: 'Claim points for the finished life' },
    'board.submit': { ur: 'میرا اسکور بھیجیں', rm: 'Mera score bhejein', en: 'Submit my score' },
    'board.login': { ur: 'اسکور بھیجنے کے لیے لاگ اِن کریں۔', rm: 'Score bhejne ke liye login karein.', en: 'Log in to submit your score.' },
    'lang': { ur: 'زبان', rm: 'Zubaan', en: 'Language' },
    'export': { ur: 'سیو فائل ڈاؤن لوڈ کریں', rm: 'Save file download karein', en: 'Download save file' },
    'import': { ur: 'سیو فائل کھولیں', rm: 'Save file kholein', en: 'Open a save file' },
    'upload.local': { ur: 'اس براؤزر کا سیو اکاؤنٹ میں ڈالیں', rm: 'Is browser ka save account mein daalein', en: 'Move this browser’s save into my account' },
    'back.life': { ur: 'لائف موڈ پر واپس', rm: 'Life Mode par wapas', en: 'Back to Life Mode' },
  };
  let lang = 'rm';
  const listeners = [];
  const t = (key, l) => { const e = D[key]; return e ? (e[l || lang] || e.rm) : key; };
  function apply(scope) {
    const r = scope || document;
    r.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.getAttribute('data-i18n')); });
    r.querySelectorAll('[data-i18n-ph]').forEach((e) => { e.setAttribute('placeholder', t(e.getAttribute('data-i18n-ph'))); });
    r.querySelectorAll('[data-i18n-title]').forEach((e) => { e.setAttribute('title', t(e.getAttribute('data-i18n-title'))); });
    document.querySelectorAll('[data-i18n-scope]').forEach((e) => { e.setAttribute('dir', lang === 'ur' ? 'rtl' : 'ltr'); e.setAttribute('lang', lang === 'ur' ? 'ur' : lang === 'en' ? 'en' : 'ur-Latn'); });
    document.querySelectorAll('select[data-lang-select]').forEach((s) => { s.value = lang; });
  }
  function setLang(l, silent) {
    if (!LANGS[l]) return; lang = l;
    try { localStorage.setItem('timewarp-lang', l); } catch (e) { /* blocked */ }
    if (typeof document !== 'undefined') apply();
    if (!silent) listeners.forEach((f) => f(l));
  }
  function init() {
    try { const v = localStorage.getItem('timewarp-lang'); if (LANGS[v]) lang = v; } catch (e) { /* blocked */ }
    document.querySelectorAll('select[data-lang-select]').forEach((s) => { s.replaceChildren(...Object.keys(LANGS).map((k) => { const o = document.createElement('option'); o.value = k; o.textContent = LANGS[k]; return o; })); s.addEventListener('change', () => setLang(s.value)); });
    apply();
  }
  const api = { LANGS, D, t, apply, setLang, onChange: (f) => listeners.push(f), get lang() { return lang; }, init };
  try { const v0 = localStorage.getItem('timewarp-lang'); if (LANGS[v0]) lang = v0; } catch (e) { /* blocked or no browser */ }   // known before any page script asks
  if (typeof document !== 'undefined' && typeof localStorage !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
  return api;
});
