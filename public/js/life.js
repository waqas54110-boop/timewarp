// TimeWarp Life Mode: one life from birth to old age, a year at a time. Pure logic (no DOM): tested in tests/life.test.js.
// The whole life is ONE plain JSON object (see create()), so the future Save mode can simply store/restore it.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpLife = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const STATS = ['health', 'knowledge', 'happiness', 'relations'];
  const VIRTUES = ['sachai', 'sabr', 'walidain', 'imandari', 'padosi'];
  const VIRTUE_NAMES = { sachai: 'Sachai', sabr: 'Sabr aur shukr', walidain: 'Walidain ki izzat', imandari: 'Imandari', padosi: 'Padosi ke haqooq' };
  const STAGES = [
    { id: 'baby', from: 0, to: 1, name: 'Baby', icon: '👶' },
    { id: 'child', from: 2, to: 4, name: 'Bachpan', icon: '🧒' },
    { id: 'school', from: 5, to: 15, name: 'School', icon: '🎒' },
    { id: 'college', from: 16, to: 21, name: 'College / University', icon: '🎓' },
    { id: 'career', from: 22, to: 59, name: 'Career', icon: '💼' },
    { id: 'senior', from: 60, to: 200, name: 'Budhapa', icon: '🧓' },
  ];
  const ERAS = {
    past: { label: 'Past (purana zamana)', hospital: 'ek chhote se shifa-khane', ride: 'tonga', school: 'lakri ki benchon wale school' },
    present: { label: 'Present (aaj ka zamana)', hospital: 'shehar ke hospital', ride: 'gaari', school: 'school' },
    future: { label: 'Future (2050)', hospital: 'ek smart hospital (robot nurse ke saath)', ride: 'hover pod', school: 'smart school (AI teacher ke saath)' },
  };
  const DEGREE = { mbbs: 'MBBS', be: 'BE Engineering', bscs: 'BS Computer Science', bsc: 'BSc', bcom: 'BCom', ba: 'BA', none: 'koi degree nahi' };
  const FIELD = { premed: 'Pre-Medical', preeng: 'Pre-Engineering', ics: 'ICS (Computer)', commerce: 'Commerce', arts: 'Arts' };
  const JOBS = {
    doctor: { name: 'Doctor', monthly: 220000, degrees: ['mbbs'] },
    engineer: { name: 'Engineer', monthly: 180000, degrees: ['be'] },
    software: { name: 'Software developer', monthly: 220000, degrees: ['bscs'] },
    pilot: { name: 'Pilot', monthly: 450000, degrees: ['be', 'bsc', 'bscs'], minKnowledge: 65, licence: true },
    accountant: { name: 'Accountant', monthly: 120000, degrees: ['bcom'] },
    teacher: { name: 'Teacher', monthly: 90000, degrees: ['bsc', 'bcom', 'ba', 'bscs', 'be', 'mbbs'] },
    business: { name: 'Karobar (business)', monthly: 150000, degrees: null },
    police: { name: 'Police officer', monthly: 110000, degrees: null, minHealth: 60 },
    shopkeeper: { name: 'Dukaandar (shopkeeper)', monthly: 100000, degrees: null },
    taxi: { name: 'Taxi driver', monthly: 90000, degrees: null, needItem: 'car', needWhy: 'Apni gaari chahiye (Meri Duniya mein khareedein)' },
    delivery: { name: 'Delivery rider', monthly: 70000, degrees: null, needItem: ['bike', 'car'], needWhy: 'Moto-cycle ya gaari chahiye (Meri Duniya mein khareedein)' },
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const stageOf = (age) => STAGES.find((s) => age >= s.from && age <= s.to);
  const fmtRs = (n) => 'Rs ' + Math.round(n).toLocaleString('en-US');
  function rand(s) { // mulberry32; the generator state lives inside the life object
    s.rs = (s.rs + 0x6D2B79F5) | 0;
    let t = Math.imul(s.rs ^ (s.rs >>> 15), 1 | s.rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
  const era = (s) => ERAS[s.era] || ERAS.present;
  const job = (s) => JOBS[s.flags.job];
  const monthlyBase = (s) => (job(s) ? Math.round(job(s).monthly * (1 + 0.15 * (s.flags.level || 0)) / 1000) * 1000 : 0);
  const yearlySaving = (s) => {
    let m = monthlyBase(s);
    if (s.flags.job === 'business') m *= 0.6 + rand(s) * 0.9; // a business has good and bad years
    return Math.round(m * 12 * 0.3 / 1000) * 1000;
  };

  // ---------- events ----------
  const E = [];
  const C = (id, label, fx, say, extra) => Object.assign({ id, label, fx: fx || {}, say: say || '' }, extra || {});
  const sch = (at, id, icon, title, text, choices, extra) => E.push(Object.assign({ id, at, icon, title, text, choices }, extra || {}));
  const rnd = (id, icon, ages, p, title, text, choices, extra) => E.push(Object.assign({ id, ages, p, icon, title, text, choices }, extra || {}));
  const needMoney = (n) => ({ why: 'Kam az kam ' + fmtRs(n) + ' chahiye', fn: (s) => s.money >= n });
  const OK = (label, fx, say) => [C('ok', label, fx, say)];
  // G(id, label, game, good, bad): a choice that starts a mini-game. The score (0..1) mixes the "good" and "bad" outcome.
  // good / bad: {fx: {...}, say: '...'}. At score 0.5 (skipped game) the result is the middle of the two.
  const G = (id, label, game, good, bad, extra) => C(id, label, {}, '', Object.assign({ game, run(s, x) {
    const sc = x.score, fx = {};
    new Set(Object.keys(good.fx || {}).concat(Object.keys(bad.fx || {}))).forEach((k) => { fx[k] = Math.round((bad.fx[k] || 0) + ((good.fx[k] || 0) - (bad.fx[k] || 0)) * sc); });
    return { fx, say: sc >= 0.7 ? good.say : sc >= 0.4 ? (good.mid || good.say) : bad.say };
  } }, extra || {}));

  // --- Baby and early childhood ---
  sch(0, 'birth', '🏥', 'Aap ka janam', (s) => `${s.name}, aap ne ${era(s).hospital} mein janam liya. Ammi abbu ne aap ko god mein liya, kaan mein azan di, aur ghar mein mithai bantee.`,
    [C('ok', 'Pehli saans lo 👶', { happiness: 5, relations: 5 }, 'Poora ghar khushi se jhoom utha.'),
      G('smile', 'Ammi ko hansao (mini-game: tezi se tap karo)', 'tap', { fx: { happiness: 8, relations: 8 }, say: 'Aap ki hansi dekh kar ammi, abbu aur dadi sab muskura diye.' }, { fx: { happiness: 3, relations: 3 }, say: 'Aap ne thora sa muskura diya, ammi ne goad mein le liya.' })]);
  sch(1, 'firstword', '🍼', 'Pehla lafz', 'Ek saal ke ho gaye. Aap ne pehli baar kuch bola. Wo kya tha?', [
    C('mama', 'Ammi!', { relations: 8, walidain: 1 }, 'Ammi ki aankhon mein aansu aa gaye, khushi ke.'),
    C('baba', 'Abbu!', { relations: 7, walidain: 1 }, 'Abbu ne aap ko goad mein utha kar ghuma diya.'),
    C('allah', 'Allah!', { relations: 4, happiness: 4, sabr: 1 }, 'Dada dadi ne kaha: ye bacha bara nek niklega, InshaAllah.'),
    G('toyplay', 'Khilonon ki jodi milao (mini-game)', 'memory', { fx: { knowledge: 5, happiness: 4 }, say: 'Aap ne saari jodiyan pehchan leen. Ghar walay hairan reh gaye!' }, { fx: { knowledge: 1, happiness: 2 }, say: 'Khilonon se khelte khelte so gaye.' })]);
  sch(2, 'firststep', '👣', 'Pehla qadam', 'Aap ne khara hona seekh liya. Ab pehla qadam!', [
    C('alone', 'Girte uthte khud chalo', { health: 4, happiness: 3, sabr: 1 }, 'Kayi baar gire, har baar uth kar dobara koshish ki.'),
    C('hand', 'Ammi ki ungli pakar kar chalo', { relations: 4, health: 2, happiness: 2 }, 'Ammi ke saath chalna sab se mehfooz laga.'),
    C('gali', 'Ghar ke darwaze se gali tak chalo', { health: 4, happiness: 4, padosi: 1 }, 'Gali mein padosi aunty ne hans kar kaha: masha Allah, bara ho gaya!')]);
  sch(3, 'toys', '🧸', 'Pasandida khilona', 'Bazaar se ek khilona milna hai. Aap kya chunte hain?', [
    C('ball', 'Gend', { health: 5, happiness: 2 }, 'Din bhar gend ke peeche bhagte rahe.'),
    C('book', 'Rangon wali kitab', { knowledge: 5, happiness: 1 }, 'Tasveerein dekh kar naye lafz seekhe.'),
    C('car', 'Chhoti si gaari', { happiness: 5, relations: 1 }, 'Gaari ko poore ghar mein dauraya.'),
    C('street', 'Khilona chhor kar gali mein bachon ke saath khelo', { health: 4, happiness: 5, relations: 4 }, 'Gali mein chhupan chhupai ka maza hi alag tha.')]);
  sch(4, 'qaida', '📖', 'Qaida aur nursery', 'Ammi ne qaida shuru karwaya aur nursery mein dakhla ho gaya.', [
    C('learn', 'Dil laga kar seekho', { knowledge: 5, relations: 2, happiness: -1 }, 'Alif, Bay, Pay... aap ko jaldi yaad ho gaye.'),
    C('play', 'Zyada khelo', { happiness: 5, health: 2, knowledge: 1 }, 'Nursery mein sab se zyada dost banaye.'),
    G('abc', 'Alif Bay Pay yaad karo (mini-game: jodiyan milao)', 'memory', { fx: { knowledge: 6, happiness: 2 }, say: 'Pehle hi din saare huroof yaad ho gaye. Teacher ne shabash kaha.' }, { fx: { knowledge: 2 }, say: 'Kuch huroof yaad hue, baaki kal.' })]);

  // --- School ---
  sch(5, 'admission', '🏫', 'School ka pehla din', (s) => `Aap ka dakhla ${era(s).school} mein ho raha hai. Naya bastah, nayi jootay!`, [
    C('private', 'Private school (acha mahaul)', { knowledge: 4, happiness: 1 }, 'Class mein jaldi sab seekhne laga.', { set: { school: 'private' } }),
    C('govt', 'Sarkari school (padosi bachay saath)', { relations: 3, happiness: 3, knowledge: 1 }, 'Mohalle ke dost saath thay.', { set: { school: 'govt' } }),
    C('home', 'School ke saath ghar par ammi se bhi parho', { knowledge: 3, relations: 4, walidain: 1 }, 'Ammi roz shaam ko saath bithati hain.', { set: { school: 'home' } })]);
  sch(7, 'habit', '✏️', 'Parhai ka andaaz', 'Teacher kehte hain ab apna andaaz banao. Aap kaise parhoge?', [
    C('hard', 'Roz homework aur dohrai', { happiness: -2 }, 'Mehnat shuru: roz parhai ka waqt tay.', { set: { effort: 5 } }),
    C('mid', 'Jitni zaroorat utna', {}, 'Na zyada dabaao, na laparwahi.', { set: { effort: 3 } }),
    C('play', 'Khel zyada, parhai kam', { happiness: 4, health: 2 }, 'Khel mein maza aaya, kitabein ek taraf.', { set: { effort: 1 } })]);
  sch(9, 'cheat', '📝', 'Imtihan mein nakal ka mauqa', 'Imtihan mein saath baitha bacha apni copy aap ki taraf kar deta hai. Jawab bilkul saamne hain.', [
    C('honest', 'Nakal nahi karoonga, sach bolunga', { knowledge: 2, relations: 3, happiness: 2, sachai: 3 }, 'Aap ne copy wapas kar di. Teacher ne tareef ki.'),
    C('cheat', 'Dekh leta hoon', { happiness: -2, relations: -1, sachai: -3 }, 'Number mil gaye, magar dil mein khalish rahi.', { set: { cheated: true } })]);
  sch(11, 'neighbour', '🏠', 'Padosi chacha ki madad', 'Padosi chacha beemar hain aur bazaar se dawai aur sauda lana hai. Aap ke dost khel rahe hain.', [
    C('help', 'Khushi se sauda la do', { padosi: 3, relations: 3, happiness: 2 }, 'Chacha ne dher saari duaen di.'),
    C('play', 'Mujhe khelna hai', { happiness: 2, padosi: -1 }, 'Chacha ne kisi aur ko bula liya.')]);
  sch(13, 'parents', '👩', 'Ammi abbu ki khidmat', 'Ammi ghar ke kaam se thak gayi hain. Aap game / kartoon dekh rahe hain.', [
    C('help', 'Madad karo', { walidain: 3, relations: 4, knowledge: -1 }, 'Ammi ne maathay par pyar diya.'),
    C('game', 'Khelte raho', { happiness: 3, walidain: -2 }, 'Ammi ne kuch nahi kaha, magar thakawat chehre par thi.')]);
  sch(14, 'prep', '📚', 'Matric ki taiyari', 'Kal se matric ki taiyari ka saal hai.', [
    C('tuition', 'Tuition lagwao', { knowledge: 5, happiness: -3 }, 'Acha teacher mila, mehnat badh gayi.', { set: { tuition: true } }),
    C('self', 'Khud mehnat', { knowledge: 3, health: -1, sabr: 1 }, 'Raaton ko jaag kar parha.'),
    C('group', 'Dosto ke saath group study', { knowledge: 3, relations: 3 }, 'Ek dosray ko samjhaya.')]);
  sch(15, 'matric', '📜', 'Matric ka nateeja', 'Imtihan ho chuka. Aaj nateeja aane wala hai.', [
    C('result', 'Nateeja dekho', {}, '', {
      run(s) {
        const f = s.flags;
        const pct = clamp(Math.round(35 + s.knowledge * 0.85 + (rand(s) * 10 - 5) + (f.tuition ? 4 : 0) + (f.cheated ? 3 : 0)), 30, 99);
        const grade = pct >= 80 ? 'A-1' : pct >= 70 ? 'A' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'D';
        const note = pct >= 80 ? 'Ammi abbu ne mithai bantee!' : pct >= 60 ? 'Ghar walon ne shabash di.' : 'Abbu ne kaha: koi baat nahi, agla imtihan aur behtar karenge.';
        return { set: { matric: pct, grade }, fx: { happiness: pct >= 80 ? 10 : pct >= 60 ? 5 : pct >= 50 ? 0 : -5 }, say: `Matric: ${pct}% (grade ${grade}). ${note}${f.cheated ? ' Magar nakal wali baat dil mein khatakti rahi.' : ''}` };
      } }),
    G('paper', 'Pehle paper do (mini-game: mushkil sawal), phir nateeja', 'quiz', { fx: { knowledge: 4, happiness: 3 }, say: 'Paper achay hue.' }, { fx: { knowledge: 0, happiness: -2 }, say: 'Paper mushkil tha.' }, { level: 3, run(s, x) {
      const f = s.flags, bonus = (x.score - 0.5) * 16;
      const pct = clamp(Math.round(35 + s.knowledge * 0.85 + (rand(s) * 10 - 5) + (f.tuition ? 4 : 0) + (f.cheated ? 3 : 0) + bonus), 30, 99);
      const grade = pct >= 80 ? 'A-1' : pct >= 70 ? 'A' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'D';
      return { set: { matric: pct, grade }, fx: { happiness: pct >= 80 ? 10 : pct >= 60 ? 5 : pct >= 50 ? 0 : -5 }, say: `Matric: ${pct}% (grade ${grade}). Paper ki taiyari ne asar dikhaya.` };
    } })]);

  // --- College / University ---
  sch(16, 'field', '🎓', 'FSc / Inter ka intekhab', (s) => `Matric mein ${s.flags.matric}% marks aaye. Ab kaun sa raasta?`, [
    C('premed', 'Pre-Medical (doctor banne ke liye)', { knowledge: 2 }, 'Biology, chemistry, physics: mushkil magar acha raasta.', { set: { field: 'premed' }, req: { why: 'Matric mein 75% chahiye', fn: (s) => s.flags.matric >= 75 } }),
    C('preeng', 'Pre-Engineering', { knowledge: 2 }, 'Maths aur physics ka maza.', { set: { field: 'preeng' }, req: { why: 'Matric mein 70% chahiye', fn: (s) => s.flags.matric >= 70 } }),
    C('ics', 'ICS (Computer Science)', { knowledge: 2, happiness: 2 }, 'Computer aur programming ki shuruaat.', { set: { field: 'ics' }, req: { why: 'Matric mein 60% chahiye', fn: (s) => s.flags.matric >= 60 } }),
    C('commerce', 'Commerce', { knowledge: 1, happiness: 2 }, 'Hisaab kitab aur karobar ki baatein.', { set: { field: 'commerce' }, req: { why: 'Matric mein 55% chahiye', fn: (s) => s.flags.matric >= 55 } }),
    C('arts', 'Arts', { happiness: 3, relations: 2 }, 'Adab, tareekh aur samaaj ki parhai.', { set: { field: 'arts' } })]);
  sch(18, 'entry', '🏛️', 'FSc ka nateeja aur dakhla', 'FSc khatam. Ab aage kya?', [
    C('uni', 'University ka entry test do', {}, '', {
      run(s) {
        const f = s.flags;
        const pct = clamp(Math.round(30 + s.knowledge * 0.8 + (rand(s) * 10 - 5) + (f.tuition ? 3 : 0)), 30, 99);
        const degree = f.field === 'premed' ? (pct >= 80 ? 'mbbs' : 'bsc') : f.field === 'preeng' ? (pct >= 75 ? 'be' : 'bsc')
          : f.field === 'ics' ? (pct >= 60 ? 'bscs' : 'bsc') : f.field === 'commerce' ? 'bcom' : 'ba';
        const sorry = (f.field === 'premed' && degree !== 'mbbs') || (f.field === 'preeng' && degree !== 'be');
        return { set: { fsc: pct, degree }, fx: { happiness: sorry ? -2 : 6, sabr: sorry ? 1 : 0 }, say: `FSc: ${pct}%. Dakhla: ${DEGREE[degree]}.${sorry ? ' Pehli pasand nahi mili, magar sabr se aage barhna hai.' : ' Alhamdulillah!'}` };
      } }),
    C('biz', 'Parhai chhor kar apna chhota karobar shuru karo', { knowledge: -2, happiness: 2, money: 300000 }, 'Abbu ne shuruaati sarmaya diya. Ab mehnat aap ki.', { set: { degree: 'none' } })]);
  sch(21, 'degree', '🎉', 'Degree ka din', (s) => (s.flags.degree === 'none' ? 'Karobar ka teesra saal mukammal hua. Bazaar ne bohat kuch sikhaya.' : `Aap ne ${DEGREE[s.flags.degree]} mukammal kar li. Convocation ka din hai.`),
    OK('Shukar Alhamdulillah', { happiness: 6, walidain: 1, relations: 3 }, 'Ammi abbu ke chehre par fakhar tha.'));

  // --- Career ---
  sch(22, 'job', '💼', 'Pehla kaam', 'Ab zindagi ka naya daur. Kaun sa kaam chunte hain?',
    Object.keys(JOBS).map((k) => {
      const j = JOBS[k];
      const ok = (s) => (!j.degrees || j.degrees.includes(s.flags.degree)) && (!j.minKnowledge || s.knowledge >= j.minKnowledge) && (!j.minHealth || s.health >= j.minHealth) && (!j.needItem || [].concat(j.needItem).some((i) => (s.items || []).includes(i))) && (!j.licence || !!s.flags.licence);
      const why = j.needWhy ? j.needWhy : j.licence ? 'Pilot licence chahiye (20 saal ki umar ka imtihan)' : j.degrees ? 'Degree: ' + j.degrees.map((d) => DEGREE[d]).join(' / ') + (j.minKnowledge ? ' aur zyada ilm' : '') : j.minHealth ? 'Sehat kam az kam ' + j.minHealth + ' honi chahiye' : '';
      return C(k, j.name, { happiness: 3 }, `Aap ne ${j.name} ke tor par kaam shuru kiya.`, { set: { job: k, level: 0 }, req: j.degrees || j.minKnowledge || j.minHealth || j.needItem || j.licence ? { why, fn: ok } : null });
    }));
  sch(26, 'marriage', '💍', 'Shadi ka faisla', 'Ghar walay rishte ki baat kar rahe hain.', [
    C('family', 'Walidain ki pasand ka rishta', { relations: 8, happiness: 4, walidain: 2, money: -250000 }, 'Dono khandaan khush the. Shadi dhoom dham se hui.', { set: { married: true } }),
    C('own', 'Apni pasand, ammi abbu ko manakar', { happiness: 6, relations: 4, money: -250000 }, 'Thori baat cheet ke baad sab raazi ho gaye.', { set: { married: true } }),
    C('later', 'Abhi nahi, pehle career', { happiness: -1, money: 100000 }, 'Aap ne kaam par tawajjo di.', { set: { married: false } })]);
  sch(28, 'child', '👶', 'Allah ne aulad ata ki', 'Ghar mein ek nanha mehmaan aaya hai!', [
    C('shukr', 'Shukar ada karo aur sadqa do', { happiness: 8, relations: 6, sabr: 2, money: -20000 }, 'Aqeeqay ka khana gareebon mein bhi bantaa gaya.', { set: { children: 1 } }),
    C('save', 'Bachay ke naam par bachat shuru karo', { happiness: 6, relations: 5, money: -30000 }, 'Mustaqbil ke liye pehla qadam.', { set: { children: 1 } })], { when: (s) => s.flags.married });
  sch(31, 'home', '🏡', 'Apna ghar', 'Ghar ka maslaa. Aap kya karenge?', [
    C('buy', 'Apna ghar kharido', { happiness: 8, money: -2000000 }, 'Chaabi haath mein lete waqt aankhein nam ho gayin.', { set: { home: 'own' }, req: needMoney(2000000) }),
    C('rent', 'Kiraye par rahen', { happiness: -1 }, 'Abhi bachat barhani hai.', { set: { home: 'rent' } }),
    C('family', 'Walidain ke saath rahen', { walidain: 3, relations: 4 }, 'Ghar mein daadi ki kahaniyan phir se goonjin.', { set: { home: 'family' } })]);
  sch(34, 'honesty', '⚖️', 'Imandari ka imtihan', (s) => (s.flags.job === 'business'
    ? 'Ek supplier kehta hai: maal ki quality kam kar do, nafa dugna ho jayega aur kisi ko pata nahi chalega.'
    : 'Ek sahib kehte hain: ek chhota sa ghalat kaam kar do, badle mein bohat paise milenge.'), [
    C('refuse', 'Saaf inkar', { imandari: 3, happiness: 3, relations: 2 }, 'Dil ka sukoon sab se bara nafa hai.'),
    C('accept', 'Ek baar le lo', { money: 500000, imandari: -3, happiness: -4 }, 'Paise aaye, magar neend kam ho gayi.')]);
  sch(38, 'neighbour2', '🏘️', 'Padosi ko zaroorat', 'Padosi ke bachay ka operation hai aur unke paas paise kam hain.', [
    C('help', 'Madad karo', { money: -100000, padosi: 3, relations: 4, happiness: 4 }, 'Unhon ne kaha: aap ne hamare liye farishte ka kaam kiya.'),
    C('sorry', 'Maazrat kar lo', { padosi: -2, happiness: -2 }, 'Baad mein dil mein afsos raha.')]);
  sch(42, 'parents2', '🧓', 'Walidain ki bimari', 'Abbu ki tabiyat kharab hai aur ammi akeli hain.', [
    C('leave', 'Chhutti le kar khidmat karo', { walidain: 4, relations: 5, money: -80000 }, 'Un ki dua aap ki sab se bari daulat ban gayi.'),
    C('both', 'Dono sambhalo (kaam bhi, khidmat bhi)', { walidain: 3, health: -4 }, 'Thak gaye, magar unhein akela nahi chhora.'),
    C('staff', 'Naukar rakh do, khud kaam karo', { walidain: -1, money: -100000 }, 'Madad mili, par un ko aap ki kami khali.')]);
  sch(45, 'checkup', '🩺', 'Sehat ka checkup', 'Doctor kehte hain ab sehat par tawajjo dene ka waqt hai.', [
    C('walk', 'Roz subah sair aur parhez', { health: 6, happiness: -1 }, 'Subah ki sair ab aap ki aadat hai.', { set: { exercise: true } }),
    C('ignore', 'Abhi kaam bahut hai', { happiness: 1 }, 'Kaam pehle, sehat baad mein.')]);
  sch(50, 'umrah', '🕋', 'Umrah ka irada', 'Dil mein Allah ke ghar ki hazri ki tamanna hai.', [
    C('go', 'Umrah par jao', { money: -500000, happiness: 10, relations: 4, sabr: 2 }, 'Dil ko wo sukoon mila jo alfaaz mein nahi aata.', { req: needMoney(500000) }),
    C('wait', 'Abhi nahi, bachat zaroori hai', { relations: 2 }, 'Niyyat rakhi hai, InshaAllah jald.')]);

  // --- Old age ---
  sch(60, 'retire', '🌇', 'Retirement', (s) => `Ab aap ${s.age} saal ke hain. Kaam se faraghat ka waqt aa gaya.`, [
    C('mosque', 'Masjid aur family mein waqt guzaro', { happiness: 6, relations: 6, sabr: 1 }, 'Ab har namaz jamaat ke saath.'),
    C('social', 'Muft kaam: logon ko parhao, madad karo', { happiness: 5, knowledge: 3, relations: 4, padosi: 2 }, 'Mohalle ke bachay aap ke paas parhne aane lage.'),
    C('travel', 'Pakistan ke khoobsurat shehron ka safar', { happiness: 8, money: -300000, health: 1 }, 'Hunza, Swat, Neelum: yaadgaar safar.')]);
  sch(65, 'grand', '👨‍👩‍👧', 'Pote potiyan', (s) => (s.flags.children ? 'Aap ke pote potiyan aap ke gird baithe hain.' : 'Aap ke bhatijay bhanje aap ke paas aaye hain.'), [
    C('story', 'Un ko kahaniyan sunao', { happiness: 6, relations: 5 }, 'Bachay khushi se sunte rahe.'),
    C('advice', 'Un ko nasihat karo: sach, sabr aur mehnat', { relations: 3, happiness: 3, sachai: 1, sabr: 1 }, 'Aap ki baatein un ke dilon mein utar gayin.')]);


  // --- Phase 3: school life (class, teacher, friends, exams) ---
  sch(6, 'teacher', '👩‍🏫', 'Teacher ka sawal', 'Class mein teacher ne sawal poocha. Aap ko jawab ka andaza hai.', [
    G('answer', 'Haath uthao aur jawab do (mini-game: sawal)', 'quiz', { fx: { knowledge: 5, happiness: 3, relations: 2 }, say: 'Teacher ne kaha: shabash, ye bacha aage jayega.' }, { fx: { knowledge: 1, happiness: -2 }, say: 'Jawab ghalat tha, magar teacher ne himmat ki daad di.' }, { level: 1 }),
    C('quiet', 'Chup raho', { happiness: -1 }, 'Aap ne dusron ko jawab dete suna.')]);
  sch(8, 'newfriend', '🧑‍🤝‍🧑', 'Naya dost', 'Class mein ek naya bacha aaya hai jo akela baitha hai.', [
    C('hello', 'Aage barh kar dosti karo', { relations: 6, happiness: 4 }, 'Aaj ka naya dost kal ka sab se acha dost ban gaya.'),
    C('ignore', 'Apne purane dosto ke saath raho', { relations: 1 }, 'Wo bacha chup chap baitha raha.')]);
  sch(10, 'classtest', '📝', 'Class test', 'Kal class test hai. Aaj sabaq dohrana hai.', [
    G('test', 'Test do (mini-game: sawal)', 'quiz', { fx: { knowledge: 6, happiness: 4 }, say: 'Test mein achay number aaye.' }, { fx: { knowledge: 1, happiness: -3 }, say: 'Number kam aaye, agli baar zyada taiyari.' }, { level: 2 }),
    C('skip', 'Bina taiyari ke chala jao', { knowledge: 0, happiness: 1 }, 'Jo aata tha wo likh diya.')]);
  sch(12, 'annual', '🏆', 'Salana imtihan', 'Saal ka aakhri imtihan aa gaya hai. Ghar mein dua ho rahi hai.', [
    G('paper', 'Paper do (mini-game: sawal)', 'quiz', { fx: { knowledge: 7, happiness: 5, walidain: 1 }, say: 'Class mein pehle teen mein aaye. Ammi abbu bohat khush hue.' }, { fx: { knowledge: 1, happiness: -2 }, say: 'Nateeja thora kamzor raha, magar aap ne himmat nahi haari.' }, { level: 2 }),
    C('rest', 'Aaram se jao, jo hoga dekha jayega', { happiness: 2, knowledge: 1 }, 'Paper theek theek hua.')]);

  // --- Phase 3: college / university life ---
  sch(17, 'campus', '🏛️', 'College ka mahaul', 'College mein pehla saal. Societies, cricket team aur library: sab kuch hai.', [
    C('society', 'Debate society mein shamil ho jao', { knowledge: 3, relations: 4, happiness: 3 }, 'Bolna aur sunna dono seekha.'),
    C('sport', 'College team mein khelo', { health: 5, relations: 4, happiness: 4 }, 'Team ke saath trophy ki taiyari.'),
    C('library', 'Library mein waqt guzaro', { knowledge: 6, happiness: -1 }, 'Kitabon ne naye darwazay khole.')]);
  sch(19, 'semester', '🧪', 'Semester ke imtihan', 'Semester ke final imtihan sar par hain.', [
    G('final', 'Paper do (mini-game: mushkil sawal)', 'quiz', { fx: { knowledge: 7, happiness: 5 }, say: 'Semester mein achi GPA aayi. Scholarship ka amkaan bhi bana.' }, { fx: { knowledge: 1, happiness: -3 }, say: 'Number kam aaye, agla semester behtar karna hai.' }, { level: 3 }),
    C('easy', 'Halki taiyari karo', { happiness: 2, knowledge: 2 }, 'Guzara ho gaya.')]);

  // --- Phase 5: the pilot licence exam (a long mini-game) ---
  sch(20, 'licence', '🛩️', 'Pilot licence ka imtihan', 'Aasman chhoone ka khwab hai? Pilot licence ke liye likhit aur flying test dono dene parte hain.', [
    G('exam', 'Licence ka imtihan do (mini-game)', 'licence', { fx: { knowledge: 5, happiness: 6 }, say: 'Aap ne licence hasil kar liya! Ab pilot ban sakte hain.' }, { fx: { knowledge: 1, happiness: -3 }, say: 'Is baar licence nahi mila. Aap ne seekha ke tayari kam thi.' }, { level: 3, run(s, x) {
      const ok = x.score >= 0.6;
      return { set: ok ? { licence: true } : {}, fx: ok ? { knowledge: 5, happiness: 6 } : { knowledge: 1, happiness: -3 }, say: ok ? 'Aap ne licence hasil kar liya! Ab pilot ban sakte hain.' : 'Is baar licence nahi mila. Aap ne seekha ke tayari kam thi.' };
    } }),
    C('skip', 'Mujhe pilot nahi banna', { happiness: 1 }, 'Aap ne doosray raaste ki taraf dekha.')], { when: (s) => s.knowledge >= 45 });

  // --- Phase 3: one working day for every job (each with a mini-game) ---
  const JOB_DAY = {
    doctor: ['🩺', 'Emergency ki raat', 'Raat ke teen baje emergency mein ek marez laaya gaya. Operation ka faisla aap ko karna hai.', 'steady', 'Operation karo (mini-game: haath ko sadha rakho)', 'Operation kamyab raha. Marez ke ghar walon ne dua di.', 'Operation mushkil raha, magar jaan bach gayi.', 'Doosre senior doctor ko bulao', 'Sab ne kaha: waqt par madad bulana bhi samajhdari hai.'],
    engineer: ['📐', 'Pul ka naqsha', 'Aap ko ek chhote pul ka naqsha manzoor karna hai. Hisaab zara sa bhi ghalat hua to khatra hai.', 'quiz', 'Hisaab jaanch lo (mini-game: sawal)', 'Naqsha bilkul durust nikla aur pul waqt par ban gaya.', 'Ek ghalti pakri gayi, dobara kaam karna para.', 'Senior se review karwao', 'Review ke baad naqsha theek hua.'],
    software: ['💻', 'Raat ka bug', 'Raat ko system mein ek bug aa gaya aur customers pareshan hain.', 'memory', 'Bug dhoondo (mini-game: jodiyan milao)', 'Aap ne bug dhoond kar fix kar diya. Boss ne shukriya kaha.', 'Bug ghanton baad mila, subah tak neend poori nahi hui.', 'Team ko bulao', 'Sab ne mil kar masla hal kiya.'],
    pilot: ['✈️', 'Mushkil landing', 'Mausam kharab hai aur runway par hawa tez chal rahi hai. Landing aap ko karni hai.', 'steady', 'Landing karo (mini-game: sahi waqt par rukein)', 'Landing nihayat narm rahi. Mussafiron ne taliyan bajayin.', 'Landing jhatkay se hui, magar sab mehfooz rahe.', 'Doosre airport par utaro', 'Mehfooz faisla: mussafir khush rahe.'],
    accountant: ['📊', 'Hisaab ki ghalti', 'Saal ke aakhir mein hisaab mein farq aa raha hai.', 'quiz', 'Hisaab milao (mini-game: sawal)', 'Farq mil gaya. Company ne aap par bharosa barhaya.', 'Hisaab milane mein poori raat lag gayi.', 'Auditor ki madad lo', 'Madad se masla hal hua.'],
    teacher: ['🍎', 'Kamzor shagird', 'Aap ke class ka ek bacha parhai mein bohat peeche hai.', 'quiz', 'Usay sabaq samjhao (mini-game: sawal)', 'Wo bacha agle imtihan mein acha nikla. Aap ko dher duaen mili.', 'Bacha abhi bhi sust hai, magar aap ne haar nahi mani.', 'Ghar walon se baat karo', 'Ghar walon ke saath mil kar bacha sambhal gaya.'],
    business: ['🧾', 'Bazaar ka sauda', 'Maal ka bara order aaya hai aur aap ko sauda tay karna hai.', 'tap', 'Tezi se hisaab aur bhaao tay karo (mini-game: tap)', 'Sauda bohat nafe mein raha.', 'Sauda barabar raha, nuksan se bach gaye.', 'Chhota order lo', 'Ehtiyat se thora nafa hua.'],
    police: ['🚓', 'Gasht ki raat', 'Gasht ke dauran ek chor bhaagta hua nazar aaya.', 'tap', 'Chor ka peecha karo (mini-game: tezi se tap)', 'Chor pakra gaya. Mohalle walay shukriya adaa karne aaye.', 'Chor bach gaya, magar aap ne ilaqay mein pehra barha diya.', 'Wireless par madad maango', 'Saathiyon ne mil kar ilaqa gher liya.'],
    taxi: ['🚕', 'Raat ki sawari', 'Raat gaye ek sawari aap ki taxi mein baithi aur kehta hai jaldi pohanchna hai. Sarak par bheed hai.', 'drive', 'Gaari chalao (mini-game: rukawaton se bacho)', 'Sawari waqt par pohanch gayi aur bakhshish bhi mili.', 'Do jhatkay lage, sawari naraz hui.', 'Aaram se chalo', 'Der hui magar sab mehfooz rahe.'],
    delivery: ['🛵', 'Garam khana', 'Bohat se order ek saath aa gaye. Raasta chun kar sab ko waqt par pohanchana hai.', 'route', 'Behtareen raasta chuno (mini-game: raasta)', 'Sab order garam garam pohanch gaye. Rating barh gayi.', 'Raasta lamba nikla aur khana thanda ho gaya.', 'Ek ek kar ke chalo', 'Aaram se kaam hua.'],
    shopkeeper: ['🏪', 'Ghahakon ki bheed', 'Eid se pehle dukaan mein bohat bheed hai aur sab jaldi mein hain.', 'tap', 'Sab ko jaldi se nimtao (mini-game: tezi se tap)', 'Sab grahak khush ho kar gaye aur dukaan ki bikri barh gayi.', 'Kuch grahak intezar se naraz ho gaye.', 'Madadgar rakh lo', 'Madadgar ne kaam halka kar diya.'],
  };
  Object.keys(JOB_DAY).forEach((k) => {
    const d = JOB_DAY[k];
    sch(24, 'work_' + k, d[0], d[1], d[2], [
      G('work', d[4], d[3], { fx: { money: 60000, knowledge: 3, happiness: 5, relations: 2 }, say: d[5] }, { fx: { money: 10000, happiness: -2 }, say: d[6] }, { level: 3 }),
      C('safe', d[7], { relations: 2, happiness: 1 }, d[8])], { when: (s) => s.flags.job === k });
  });

  // --- Phase 3: marriage and family, generations ---
  sch(33, 'kidsschool', '🎒', 'Bachon ka school', 'Aap ke bachon ke school ka dakhla hai.', [
    C('good', 'Achay school mein dakhla karwao', { money: -300000, relations: 4, happiness: 3 }, 'Bachay roz khushi se school jate hain.'),
    C('near', 'Mohalle ke school mein bhejo, ghar par khud padhao', { relations: 5, walidain: 0, knowledge: 1, happiness: 2 }, 'Roz shaam ko aap un ka sabaq sunte hain.')], { when: (s) => !!s.flags.children });
  sch(55, 'kidwedding', '💐', 'Beta / beti ki shadi', 'Aap ke bachay ki shadi ka waqt aa gaya hai.', [
    C('simple', 'Sadgi se aur Sunnat ke mutabiq shadi karo', { money: -500000, happiness: 8, relations: 6, sabr: 1 }, 'Dua aur sadgi ne shadi ko barkat wali bana diya.'),
    C('grand', 'Dhoom dham se shadi karo', { money: -1500000, happiness: 5, relations: 4 }, 'Bohat dhoom dham hui, magar akhrajaat bhi bohat hue.', { req: needMoney(1500000) })], { when: (s) => !!s.flags.children });
  sch(70, 'oldmemories', '📔', 'Purani yaadein', (s) => `${s.name}, ${s.age} saal ki umar mein aap purani yaadon ko dohra rahe hain.`, [
    C('diary', 'Diary likho aur bachon ko sunao', { happiness: 6, relations: 5 }, 'Aap ki zindagi ki kahani ab ghar ki amanat ban gayi.'),
    C('album', 'Purani tasveeron ka album dekho', { happiness: 4, relations: 3 }, 'Har tasveer ke saath ek hansi ya aansu.'),
    C('dua', 'Shukar aur dua mein waqt guzaro', { happiness: 5, sabr: 2 }, 'Dil ko sukoon aur imaan ko taazgi mili.')]);

  // --- Random events (any year, if nothing scheduled) ---
  rnd('fever', '🤒', [1, 12], 0.25, 'Bukhar', 'Raat ko tez bukhar ho gaya.', [
    C('doctor', 'Doctor ko dikhao', { health: 2, relations: 1 }, 'Dawai se jaldi aaram aa gaya.'),
    C('rest', 'Sabr se ghar par aaram', { health: -3, sabr: 2 }, 'Kayi din lage, magar thik ho gaye.')]);
  rnd('fight', '😠', [6, 14], 0.25, 'Khel ke maidan mein jhagra', 'Dost se bahas ho gayi aur baat dhakka-mukki tak pahunch gayi.', [
    C('sorry', 'Maafi mang lo', { relations: 3, sabr: 1 }, 'Dosti phir se pakki ho gayi.'),
    C('revenge', 'Badla lo', { happiness: 2, relations: -4, sabr: -1 }, 'Teacher ne dono ko saza di.')]);
  rnd('cricket', '🏏', [6, 16], 0.3, 'Cricket match', 'Mohalle ki cricket team mein ek khali jagah hai.', [
    C('play', 'Team mein khelo', { health: 4, happiness: 4, knowledge: -1 }, 'Match jeet gaye!'),
    C('study', 'Parhai karo', { knowledge: 3, happiness: -1 }, 'Ghar ja kar kitab khol li.')]);
  rnd('lunch', '🥪', [7, 15], 0.2, 'Dost ka khali tifin', 'Aap ka ek dost aaj lunch nahi laya.', [
    C('share', 'Apna lunch baant lo', { relations: 4, happiness: 2 }, 'Aadha lunch, dugni khushi.'),
    C('keep', 'Apna hi khalo', { happiness: 1 }, 'Pet bhar gaya, dil khali rahaa.')]);
  rnd('found', '💰', [8, 30], 0.1, 'Gum shuda paise', 'Raste mein ek pursa mila jis mein kuch paise aur ek card hai.', [
    C('return', 'Maalik ko dhoond kar lauta do', { sachai: 3, happiness: 4, relations: 2 }, 'Maalik ne bohat dua di.'),
    C('keep', 'Rakh lo', { money: 5000, sachai: -3, happiness: -2 }, 'Paise to mil gaye, par mann bojhil raha.')]);
  rnd('phone', '📱', [13, 24], 0.3, 'Raat bhar mobile', 'Raat ke 2 baj gaye, video khatam hi nahi hoti.', [
    C('scroll', 'Dekhte raho', { happiness: 3, knowledge: -3, health: -2 }, 'Subah aankhein bhari thi.'),
    C('sleep', 'Waqt par so jao', { health: 3, knowledge: 1 }, 'Subah taza dam uthe.')]);
  rnd('scholar', '🏅', [16, 20], 0.2, 'Wazifay ka test', 'Aap ke ilm ko dekh kar teacher ne wazifay ka test dene ko kaha.', [
    C('try', 'Test do', {}, '', { run: (s) => (rand(s) < s.knowledge / 100 + 0.1
      ? { fx: { money: 120000, knowledge: 3, happiness: 6 }, say: 'Wazifa mil gaya! Mehnat rang laayi.' }
      : { fx: { happiness: -3, sabr: 1 }, say: 'Is baar nahi mila. Sabr karo, agli baar behtar.' }) }),
    C('skip', 'Rehne do', {}, 'Aap ne aaram chuna.')], { once: true, when: (s) => s.knowledge >= 40 });
  rnd('intern', '🧑‍💻', [19, 21], 0.2, 'Internship', 'Ek company chhutiyon mein internship de rahi hai.', [
    C('do', 'Internship karo', { knowledge: 3, money: 30000, health: -1 }, 'Kaam seekha aur pehli kamai hui.'),
    C('rest', 'Chhutiyan enjoy karo', { happiness: 4 }, 'Dosto ke saath ghoomay.')], { once: true });
  rnd('bonus', '🎁', [23, 58], 0.25, 'Bonus mila', 'Is saal acha kaam karne par bonus mila.', [
    C('save', 'Bachat karo', {}, '', { run: (s) => ({ fx: { money: monthlyBase(s) * 3 }, say: 'Sab kuch bachat mein gaya.' }) }),
    C('family', 'Ghar walon par kharch karo', { relations: 4, happiness: 4 }, '', { run: (s) => ({ fx: { money: Math.round(monthlyBase(s)) }, say: 'Sab ne mil kar khushi manayi.' }) }),
    C('sadqa', 'Sadqa do, shukar karo', { happiness: 5, sabr: 1, padosi: 1 }, '', { run: (s) => ({ fx: { money: Math.round(monthlyBase(s) * 2) }, say: 'Dil ko sukoon mila.' }) })], { when: (s) => !!s.flags.job });
  rnd('loss', '📉', [24, 55], 0.12, 'Nuksan', 'Is saal kaam mein bara nuksan ho gaya.', [
    C('patience', 'Sabr se nayi koshish', { sabr: 3, happiness: -2, money: -100000 }, 'Mushkil waqt guzar gaya, hosla kaam aaya.'),
    C('quit', 'Hosla haar do', { happiness: -6, sabr: -2, money: -100000 }, 'Kayi hafte udaasi mein guzray.')], { when: (s) => !!s.flags.job });
  rnd('illness', '🏥', [30, 60], 0.15, 'Beemari', 'Sehat achanak bigar gayi.', [
    C('care', 'Doctor aur parhez', { money: -80000, health: 4 }, 'Waqt par ilaaj ne bacha liya.'),
    C('ignore', 'Nazar andaaz karo', { health: -8 }, 'Takleef barh gayi.')]);
  rnd('promo', '📈', [28, 55], 0.2, 'Tarqi ka mauqa', 'Aap ko bari zimmedari di ja rahi hai.', [
    C('yes', 'Zimmedari qubool karo', { health: -2, happiness: 4 }, '', { run(s) { return { set: { level: (s.flags.level || 0) + 1 }, say: 'Tankhwah aur ohda dono barhe.' }; } }),
    C('no', 'Aaram se rehne do', { happiness: 2 }, 'Aap ne sukoon ko tarjeeh di.')], { when: (s) => !!s.flags.job && s.flags.job !== 'business' });
  rnd('friend', '🤝', [25, 70], 0.15, 'Purana dost mila', 'Bachpan ka dost achanak mil gaya.', [
    C('home', 'Ghar bulao', { relations: 5, happiness: 4 }, 'Poori raat purani baatein.'),
    C('phone', 'Phone par baat karo', { relations: 2 }, 'Dobara rabta shuru ho gaya.')]);
  rnd('mosque', '🕌', [60, 100], 0.3, 'Masjid ke dost', 'Namaz ke baad purane saathi chai ki dawat dete hain.', [
    C('sit', 'Roz namaz ke baad baithak', { happiness: 5, relations: 4, health: 1 }, 'Subah ki baithak din ban gayi.'),
    C('home', 'Seedha ghar jao', { happiness: 1 }, 'Ghar mein aaram kiya.')]);
  rnd('oldhealth', '🌳', [60, 100], 0.3, 'Sehat', 'Doctor ne chalne phirne ki salah di.', [
    C('walk', 'Subah ki sair', { health: 4 }, 'Jism halka laga.'),
    C('rest', 'Zyada aaram', { health: -2 }, 'Jodon mein akraahat barh gayi.')]);

  const FINALE = {
    id: 'finale', finale: true, icon: '🌅', title: 'Zindagi ka safar',
    text: (s) => `${s.name}, ${s.age} saal ki umar mein aap ki lambi zindagi ka safar mukammal hua. Aap ke peeche ${s.flags.children ? 'bachay, pote potiyan aur ' : ''}dua dene walay bohat se log hain.`,
    choices: [C('end', 'Zindagi ka khulasa dekho', { happiness: 5 }, 'Allah aap ki maghfirat farmaye aur aap ke liye aasani paida kare.')],
  };
  const BY_ID = {}; E.concat([FINALE]).forEach((e) => { BY_ID[e.id] = e; });

  // ---------- engine ----------
  function instantiate(ev, s) {
    return {
      id: ev.id, icon: ev.icon, title: ev.title, scheduled: ev.at !== undefined, finale: !!ev.finale,
      text: typeof ev.text === 'function' ? ev.text(s) : ev.text,
      choices: ev.choices.map((c) => { const bad = c.req && !c.req.fn(s); return { id: c.id, label: c.label, locked: !!bad, why: bad ? c.req.why : '', game: c.game || null, level: c.level || 1 }; }),
    };
  }
  function pickEvent(s) {
    const sched = E.find((e) => e.at === s.age && (!e.when || e.when(s)));
    if (sched) return instantiate(sched, s);
    const eligible = E.filter((e) => e.ages && s.age >= e.ages[0] && s.age <= e.ages[1] && (!e.when || e.when(s))
      && !(s.seen[e.id] !== undefined && (e.once || s.age - s.seen[e.id] < 6)));
    if (!eligible.length || rand(s) > 0.55) return null;
    let r = rand(s) * eligible.reduce((a, e) => a + e.p, 0), chosen = eligible[eligible.length - 1];
    for (const e of eligible) { r -= e.p; if (r <= 0) { chosen = e; break; } }
    s.seen[chosen.id] = s.age;
    return instantiate(chosen, s);
  }
  function applyFx(s, fx) {
    const applied = {};
    Object.keys(fx || {}).forEach((k) => {
      const before = k === 'money' ? s.money : STATS.includes(k) ? s[k] : s.virtues[k];
      let after;
      if (k === 'money') after = Math.max(0, s.money + fx[k]);
      else if (STATS.includes(k)) after = clamp(s[k] + fx[k], k === 'health' ? 5 : 0, 100);
      else after = clamp((s.virtues[k] || 0) + fx[k], -20, 50);
      if (k === 'money') s.money = after; else if (STATS.includes(k)) s[k] = after; else s.virtues[k] = after;
      if (after !== before) applied[k] = after - before;
    });
    return applied;
  }
  const YEAR_LINES = {
    baby: ['Ammi ki god mein ek aur mahina guzra.', 'Ghar bhar aap ki hansi se goonj raha hai.'],
    child: ['Aap ne naye lafz seekhe aur gali mein khela.', 'Din khilono aur kahaniyon mein guzre.'],
    school: ['Class mein ek aur saal guzar gaya.', 'Nayi kitabein, nayi dosti.', 'Imtihan aaye aur guzar gaye.'],
    college: ['College ka saal lectures aur chai ke beech guzra.', 'Dosto ke saath parhai aur yaadein.'],
    career: ['Kaam, ghar aur zimmedariyon ke saath ek aur saal.', 'Rozmarrah ki mehnat jaari rahi.', 'Saal sukoon se guzar gaya.'],
    senior: ['Pote potiyon aur masjid ke beech sukoon ka saal.', 'Aap ne purani yaadon ko dohraya.', 'Din aaraam se guzar gaye.'],
  };
  function tick(s) {
    const a = s.age, st = stageOf(a).id, f = s.flags;
    s.stage = st;
    if (st === 'baby' || st === 'child') s.knowledge = clamp(s.knowledge + 2, 0, 100);
    else if (st === 'school' || st === 'college') s.knowledge = clamp(s.knowledge + (f.effort || 3), 0, 100);
    if (st === 'career' && f.job) s.money += yearlySaving(s);
    if (st === 'senior' && f.job) s.money += Math.round(monthlyBase(s) * 12 * 0.15 / 1000) * 1000;
    const drop = a >= 60 ? (f.exercise ? 1 : 2) : a >= 40 ? (f.exercise ? 0 : 1) : 0;
    s.health = clamp(s.health - drop, 5, 100);
    if (a > 22 && a % 2 === 0 && !f.married) s.relations = clamp(s.relations - 1, 0, 100);
    if (s.happiness > 55) s.happiness -= 1; else if (s.happiness < 45) s.happiness += 1;
    s.hsum += s.health; s.hn += 1;
    passive(s);
  }
  function endAgeFor(s) {
    const avg = s.hsum / Math.max(1, s.hn);
    return clamp(Math.round(66 + avg * 0.22 + (s.flags.exercise ? 3 : 0)), 62, 90);
  }


  // ---------- Phase 5: home, things, pets, dreams, diary, time capsule, time-machine perks ----------
  const ERA_PRICE = { past: 0.5, present: 1, future: 1.6 };
  // prices follow the era and rise 2% for every year after 20
  const price = (s, base) => Math.round((base * (ERA_PRICE[s.era] || 1) * (1 + 0.02 * Math.max(0, s.age - 20))) / 1000) * 1000;
  const HOMES = [
    { id: 'rent', name: 'Kiraye ka kamra', icon: '🏚️', cost: 0, slots: 2, fx: {} },
    { id: 'flat', name: 'Chhota apna ghar', icon: '🏠', cost: 6000000, slots: 5, fx: { happiness: 1, relations: 1 } },
    { id: 'house', name: 'Bara ghar', icon: '🏡', cost: 15000000, slots: 9, fx: { happiness: 2, health: 1, relations: 1 } },
    { id: 'villa', name: 'Bungalow', icon: '🏰', cost: 45000000, slots: 14, fx: { happiness: 3, health: 2, relations: 2 } },
  ];
  const ITEMS = [
    { id: 'bed', name: 'Aaramdeh bistar', icon: '🛏️', cost: 40000, fx: { health: 1 } },
    { id: 'books', name: 'Kitabon ki almari', icon: '📚', cost: 30000, fx: { knowledge: 1 } },
    { id: 'musalla', name: 'Ibadat ka kona', icon: '🕌', cost: 8000, fx: { sabr: 1 } },
    { id: 'tv', name: 'TV', icon: '📺', cost: 90000, fx: { happiness: 1 } },
    { id: 'ac', name: 'AC / cooler', icon: '❄️', cost: 120000, fx: { health: 1 } },
    { id: 'computer', name: 'Computer', icon: '💻', cost: 160000, fx: { knowledge: 1 } },
    { id: 'garden', name: 'Baagh', icon: '🌳', cost: 250000, fx: { happiness: 1, health: 1 }, minTier: 1 },
    { id: 'piano', name: 'Harmonium / piano', icon: '🎹', cost: 350000, fx: { happiness: 2 } },
    { id: 'bike', name: 'Moto-cycle', icon: '🏍️', cost: 250000, fx: { happiness: 1 }, vehicle: true },
    { id: 'car', name: 'Gaari', icon: '🚗', cost: 2800000, fx: { happiness: 1 }, vehicle: true },
  ];
  const PETS = [
    { id: 'fish', name: 'Machli', icon: '🐠', cost: 5000, life: 4, fx: { happiness: 1 } },
    { id: 'parrot', name: 'Totta', icon: '🦜', cost: 20000, life: 25, fx: { happiness: 1, relations: 1 } },
    { id: 'cat', name: 'Billi', icon: '🐱', cost: 30000, life: 14, fx: { happiness: 2 } },
    { id: 'dog', name: 'Kutta', icon: '🐶', cost: 50000, life: 13, fx: { happiness: 2, health: 1 } },
    { id: 'horse', name: 'Ghora', icon: '🐴', cost: 400000, life: 25, fx: { happiness: 2, health: 1 }, minTier: 2 },
  ];
  const HOME_BY = {}; HOMES.forEach((h, i) => { h.tier = i; HOME_BY[h.id] = h; });
  const ITEM_BY = {}; ITEMS.forEach((i) => { ITEM_BY[i.id] = i; });
  const PET_BY = {}; PETS.forEach((p) => { PET_BY[p.id] = p; });
  const PERKS = {   // bought with Time Machine points (see public/js/meta.js); each one changes how a new life starts
    rich: { name: 'Dolat ka aghaz', icon: '💰', cost: 50, desc: 'Zindagi Rs 2 million ke saath shuru', apply: (s) => { s.money += 2000000; } },
    scholar: { name: 'Ilm ka chiragh', icon: '📖', cost: 60, desc: 'Ilm +10 se shuru', apply: (s) => { s.knowledge = clamp(s.knowledge + 10, 0, 100); } },
    healthy: { name: 'Mazboot jism', icon: '💪', cost: 40, desc: 'Sehat +10 se shuru', apply: (s) => { s.health = clamp(s.health + 10, 5, 100); s.hsum = s.health; } },
    friends: { name: 'Mehrbaan log', icon: '🤝', cost: 40, desc: 'Rishtay +10 se shuru', apply: (s) => { s.relations = clamp(s.relations + 10, 0, 100); } },
    joy: { name: 'Khush mizaj', icon: '😊', cost: 40, desc: 'Khushi +10 se shuru', apply: (s) => { s.happiness = clamp(s.happiness + 10, 0, 100); } },
    mentor: { name: 'Acha ustaad', icon: '🧑‍🏫', cost: 80, desc: 'Parhai mein har saal +1 zyada ilm', apply: (s) => { s.flags.effort = 4; } },
  };
  const DREAMS = [
    { id: 'doctor', label: 'Doctor banna', done: (s) => s.flags.job === 'doctor' },
    { id: 'pilot', label: 'Pilot banna', done: (s) => s.flags.job === 'pilot' },
    { id: 'engineer', label: 'Engineer banna', done: (s) => s.flags.job === 'engineer' },
    { id: 'teacher', label: 'Ustaad banna', done: (s) => s.flags.job === 'teacher' },
    { id: 'business', label: 'Apna karobar', done: (s) => s.flags.job === 'business' || s.flags.job === 'shopkeeper' },
    { id: 'family', label: 'Khushhal khandaan', done: (s) => !!(s.flags.married && s.flags.children) },
    { id: 'scholar', label: 'Bara aalim (ilm 90)', done: (s) => s.knowledge >= 90 },
    { id: 'rich', label: 'Dolatmand (Rs 50 million)', done: (s) => s.money >= 50000000 },
    { id: 'villa', label: 'Apna bungalow', done: (s) => homeTier(s) >= 3 },
    { id: 'pets', label: 'Janwaron se pyar (3 pets)', done: (s) => (s.flags.petsEver || 0) >= 3 },
    { id: 'loved', label: 'Sab ke dil mein jagah (rishtay 90)', done: (s) => s.relations >= 90 },
  ];
  const DREAM_BY = {}; DREAMS.forEach((d) => { DREAM_BY[d.id] = d; });
  const homeTier = (s) => (HOME_BY[s.home] ? HOME_BY[s.home].tier : 0);
  const rentOf = (s) => price(s, 240000);
  function goals(s) { return DREAMS.map((d) => ({ id: d.id, label: d.label, done: !!d.done(s), dream: s.dream === d.id })).sort((a, b) => (b.dream ? 1 : 0) - (a.dream ? 1 : 0)); }

  // passive effects of home, things and pets, once a year (no random numbers: a life must replay exactly)
  function passive(s) {
    const h = HOME_BY[s.home] || HOMES[0];
    applyFx(s, h.fx);
    (s.items || []).forEach((id) => { if (ITEM_BY[id]) applyFx(s, ITEM_BY[id].fx); });
    const gone = [];
    s.pets = (s.pets || []).filter((p) => {
      const d = PET_BY[p.id];
      if (s.age - p.since >= d.life) { gone.push(d); return false; }
      applyFx(s, d.fx); return true;
    });
    gone.forEach((d) => {
      s.happiness = clamp(s.happiness - 3, 0, 100);
      s.log.push({ age: s.age, kind: 'year', text: d.icon + ' Aap ka pyara ' + d.name + ' ab is duniya mein nahi raha. Dil udaas hai.' });
      s.memories.push({ age: s.age, icon: d.icon, title: d.name + ' ki yaad', text: 'Saalon ka saathi ' + d.name + ' chal basa.' });
    });
    if (s.age >= 22 && s.flags.job && homeTier(s) === 0) s.money = Math.max(0, s.money - rentOf(s));   // kiraya
  }
  const record = (s, h) => { if (!s.hist) s.hist = []; if (s.hist.length < 400) s.hist.push(h); else s.seed0 = null; };
  // act(life, 'home'|'item'|'pet'|'sell'|'capsule', id) -> {ok, why, say}. Every action is also written into the life's history so it can be replayed.
  function act(s, kind, id, extra) {
    const no = (why) => ({ ok: false, why });
    if (s.over) return no('Zindagi mukammal ho chuki hai');
    if (kind === 'home') {
      const h = HOME_BY[id]; if (!h) return no('Aisa ghar nahi');
      if (s.age < 18) return no('Ghar 18 saal ke baad khareed sakte hain');
      if (h.tier <= homeTier(s)) return no('Aap ke paas is se behtar ghar hai');
      const c = price(s, h.cost); if (s.money < c) return no('Paisa kam hai (' + fmtRs(c) + ' chahiye)');
      s.money -= c; s.home = h.id; record(s, { a: 'home', id, age: s.age });
      s.memories.push({ age: s.age, icon: h.icon, title: 'Naya ghar', text: 'Aap ne ' + h.name + ' liya.' });
      return { ok: true, say: h.name + ' mubarak ho!' };
    }
    if (kind === 'item') {
      const it = ITEM_BY[id]; if (!it) return no('Aisi cheez nahi');
      if (s.age < 18) return no('Ye cheez 18 saal ke baad khareed sakte hain');
      if ((s.items || []).includes(id)) return no('Ye aap ke paas pehle se hai');
      if (it.minTier && homeTier(s) < it.minTier) return no('Pehle behtar ghar chahiye');
      const used = (s.items || []).filter((x) => !ITEM_BY[x].vehicle).length;
      if (!it.vehicle && used >= (HOME_BY[s.home] || HOMES[0]).slots) return no('Ghar mein jagah nahi, bara ghar lein');
      const c = price(s, it.cost); if (s.money < c) return no('Paisa kam hai (' + fmtRs(c) + ' chahiye)');
      s.money -= c; (s.items = s.items || []).push(id); record(s, { a: 'item', id, age: s.age });
      return { ok: true, say: it.name + ' kharid li.' };
    }
    if (kind === 'sell') {
      if (!(s.items || []).includes(id)) return no('Ye cheez aap ke paas nahi');
      s.money += Math.round(price(s, ITEM_BY[id].cost) * 0.5 / 1000) * 1000; s.items = s.items.filter((x) => x !== id); record(s, { a: 'sell', id, age: s.age });
      return { ok: true, say: ITEM_BY[id].name + ' bech di.' };
    }
    if (kind === 'pet') {
      const d = PET_BY[id]; if (!d) return no('Aisa janwar nahi');
      if (s.age < 6) return no('Abhi bohat chhote hain');
      if ((s.pets || []).length >= 3) return no('Ghar mein sirf 3 janwar rakh sakte hain');
      if (d.minTier && homeTier(s) < d.minTier) return no('Pehle behtar ghar chahiye');
      const c = s.age < 18 ? 0 : price(s, d.cost);   // children get their first pets from the family
      if (s.age < 18 && d.cost > 30000) return no('Ammi abbu is ke liye abhi nahi maanenge');
      if (s.money < c) return no('Paisa kam hai (' + fmtRs(c) + ' chahiye)');
      s.money -= c; (s.pets = s.pets || []).push({ id, since: s.age }); s.flags.petsEver = (s.flags.petsEver || 0) + 1; record(s, { a: 'pet', id, age: s.age });
      s.memories.push({ age: s.age, icon: d.icon, title: 'Naya saathi', text: 'Aap ne ' + d.name + ' paala.' });
      return { ok: true, say: d.name + ' ab aap ke ghar ka hissa hai.' };
    }
    if (kind === 'capsule') {
      const text = String((extra && extra.text) || '').trim().slice(0, 400), years = Math.round(Number(extra && extra.years));
      if (s.capsule) return no('Time capsule pehle se band hai');
      if (!text) return no('Khat khali hai');
      if (!(years >= 3 && years <= 60) || s.age + years > 110) return no('3 se 60 saal ke baad ka waqt chunein');
      s.capsule = { text, from: s.age, open: s.age + years, opened: false }; record(s, { a: 'capsule', id: text, age: s.age, y: years });
      return { ok: true, say: 'Khat band ho gaya. Ye ' + (s.age + years) + ' saal ki umar mein khulega.' };
    }
    return no('Ye kaam samajh nahi aaya');
  }
  function addDiary(s, text) {
    const t = String(text || '').trim().slice(0, 240); if (!t) return false;
    if (!s.diary) s.diary = []; if (s.diary.length >= 100) s.diary.shift();
    s.diary.push({ age: s.age, text: t }); return true;
  }
  // everything the player's diary shows, oldest first: own notes and the life's memories
  function diaryEntries(s) {
    return (s.diary || []).map((d) => ({ age: d.age, icon: '✍️', title: 'Meri tehreer', text: d.text, mine: true }))
      .concat((s.memories || []).map((m) => ({ age: m.age, icon: m.icon, title: m.title, text: m.text, mine: false }))).sort((a, b) => a.age - b.age);
  }
  // familyTree(life): people and pets around the player, as nodes with a generation number (0 = grandparents ... 3 = grandchildren)
  function familyTree(s) {
    const n = [{ id: 'g1', gen: 0, icon: '👴', label: 'Dada / Nana' }, { id: 'g2', gen: 0, icon: '👵', label: 'Dadi / Nani' },
      { id: 'dad', gen: 1, icon: '👨', label: 'Abbu' }, { id: 'mom', gen: 1, icon: '👩', label: 'Ammi' }, { id: 'me', gen: 2, icon: s.age >= 60 ? '🧓' : '🙂', label: s.name, me: true }];
    if (s.flags.married) n.push({ id: 'spouse', gen: 2, icon: '💍', label: 'Shareek-e-hayat' });
    if (s.flags.children) { n.push({ id: 'c1', gen: 3, icon: '🧒', label: 'Beta' }, { id: 'c2', gen: 3, icon: '👧', label: 'Beti' }); }
    if (s.flags.children && s.age >= 55) n.push({ id: 'gc1', gen: 4, icon: '👶', label: 'Pota' }, { id: 'gc2', gen: 4, icon: '👶', label: 'Poti' });
    (s.pets || []).forEach((p, i) => n.push({ id: 'pet' + i, gen: 2, icon: PET_BY[p.id].icon, label: PET_BY[p.id].name, pet: true }));
    return n;
  }
  const CAPSULE = {
    id: 'capsule', icon: '⏳', title: 'Time Capsule khul gaya',
    text: (s) => `Ek purana khat mila. ${s.capsule.from} saal ki umar mein aap ne khud ko likha tha: "${s.capsule.text}"  Aaj aap ${s.age} saal ke hain.`,
    choices: [C('smile', 'Muskura kar parho', { happiness: 6, relations: 2 }, 'Purane khwab aur nayi haqeeqat ek saath nazar aaye.'),
      C('goal', 'Naye maqsad likho', { knowledge: 2, happiness: 3, sabr: 1 }, 'Aap ne is khat se naya hausla liya.')],
  };
  BY_ID.capsule = CAPSULE;

  // create({name, era, seed, dream, perks}) -> a new life, already showing its first event (the birth)
  function create(opts) {
    const o = opts || {};
    const s = {
      v: 1, name: String(o.name || 'Musafir').trim().slice(0, 20) || 'Musafir', era: ERAS[o.era] ? o.era : 'present',
      rs: (o.seed == null ? Math.floor(Math.random() * 2147483647) : o.seed) | 0,
      age: 0, stage: 'baby', health: 70, knowledge: 5, happiness: 60, relations: 60, money: 0,
      virtues: { sachai: 0, sabr: 0, walidain: 0, imandari: 0, padosi: 0 },
      flags: { effort: 3, level: 0 }, seen: {}, hsum: 70, hn: 1, endAge: 0,
      pending: null, over: false, log: [], memories: [],
      seed0: null, hist: [], home: 'rent', items: [], pets: [], diary: [], capsule: null, dream: DREAM_BY[o.dream] ? o.dream : null, perks: [],
    };
    s.seed0 = s.rs;
    (Array.isArray(o.perks) ? o.perks : []).forEach((id) => { if (PERKS[id] && !s.perks.includes(id)) { s.perks.push(id); PERKS[id].apply(s); } });
    s.pending = pickEvent(s);
    return s;
  }
  // choose(life, choiceId): applies the choice and returns {say, changes}
  // extra.score (0..1) is the result of the mini-game the choice asked for; without a game it counts as an average 0.5
  function choose(s, choiceId, extra) {
    if (s.over || !s.pending) throw new Error('No decision is waiting');
    const ev = BY_ID[s.pending.id], c = ev && ev.choices.find((x) => x.id === choiceId);
    if (!c) throw new Error('Unknown choice');
    if (c.req && !c.req.fn(s)) throw new Error('This choice is locked: ' + c.req.why);
    const score = extra && Number.isFinite(extra.score) ? clamp(extra.score, 0, 1) : 0.5;
    record(s, { e: s.pending.id, c: choiceId, g: c.game && extra && Number.isFinite(extra.score) ? Math.round(score * 1000) / 1000 : null, o: s.pending.choices.filter((x) => !x.locked).map((x) => x.id).slice(0, 8), age: s.age });
    const out = c.run ? c.run(s, { score }) : {};
    if (c.set) Object.assign(s.flags, c.set);
    if (out.set) Object.assign(s.flags, out.set);
    const changes = applyFx(s, Object.assign({}, c.fx, out.fx));
    const say = out.say || c.say || '';
    if (c.game && extra && Number.isFinite(extra.score)) { s.flags.games = (s.flags.games || 0) + 1; if (score >= 0.7) s.flags.gamesWon = (s.flags.gamesWon || 0) + 1; }
    s.log.push({ age: s.age, kind: 'event', text: s.pending.title + ': ' + c.label });
    if (say) s.log.push({ age: s.age, kind: 'result', text: say });
    if (s.pending.scheduled) s.memories.push({ age: s.age, icon: s.pending.icon, title: s.pending.title, text: say || c.label });
    if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
    if (s.pending.finale) s.over = true;
    s.pending = null;
    return { say, changes };
  }
  // advance(life): moves forward year by year until the next decision (or the end of the life)
  function advance(s) {
    if (s.over || s.pending) return s;
    for (let guard = 0; guard < 120; guard++) {
      s.age += 1; tick(s);
      if (s.age >= 60 && !s.endAge) s.endAge = endAgeFor(s);
      const capsuleDue = s.capsule && !s.capsule.opened && s.age >= s.capsule.open;
      if (s.endAge && s.age >= s.endAge) { if (capsuleDue) { s.capsule.opened = true; s.pending = instantiate(CAPSULE, s); return s; } s.pending = instantiate(FINALE, s); return s; }
      const ev = pickEvent(s);
      if (ev) { s.pending = ev; return s; }
      if (capsuleDue) { s.capsule.opened = true; s.pending = instantiate(CAPSULE, s); return s; }
      s.log.push({ age: s.age, kind: 'year', text: pick(s, YEAR_LINES[s.stage]) });
    }
    s.over = true; return s;
  }
  // restore(raw): checks a life that came from outside (a save file, the browser, the server) and returns a clean copy, or null.
  // Only known fields survive and every number is clamped, so a damaged or hand-edited save can never break the game.
  function restore(raw) {
    try {
      if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
      const num = (v, a, b, d) => (Number.isFinite(v) ? clamp(Math.round(v), a, b) : d);
      const s = {
        v: 1, name: String(raw.name || 'Musafir').trim().slice(0, 20) || 'Musafir', era: ERAS[raw.era] ? raw.era : 'present',
        rs: num(raw.rs, -2147483648, 2147483647, 1), age: num(raw.age, 0, 120, 0), stage: 'baby',
        health: num(raw.health, 5, 100, 70), knowledge: num(raw.knowledge, 0, 100, 5), happiness: num(raw.happiness, 0, 100, 60), relations: num(raw.relations, 0, 100, 60),
        money: num(raw.money, 0, 1e10, 0), virtues: {}, flags: {}, seen: {},
        hsum: num(raw.hsum, 0, 1e6, 70), hn: num(raw.hn, 1, 1000, 1), endAge: num(raw.endAge, 0, 120, 0),
        pending: null, over: !!raw.over, log: [], memories: [],
      };
      s.stage = stageOf(s.age).id;
      s.seed0 = Number.isFinite(raw.seed0) ? num(raw.seed0, -2147483648, 2147483647, 1) : null;
      s.home = HOME_BY[raw.home] ? raw.home : 'rent';
      s.items = (Array.isArray(raw.items) ? raw.items : []).filter((x, i, a) => ITEM_BY[x] && a.indexOf(x) === i).slice(0, 20);
      s.pets = (Array.isArray(raw.pets) ? raw.pets : []).filter((p) => p && PET_BY[p.id]).slice(0, 3).map((p) => ({ id: p.id, since: num(p.since, 0, 120, 0) }));
      s.dream = DREAM_BY[raw.dream] ? raw.dream : null;
      s.perks = (Array.isArray(raw.perks) ? raw.perks : []).filter((x, i, a) => PERKS[x] && a.indexOf(x) === i);
      s.diary = (Array.isArray(raw.diary) ? raw.diary.slice(-100) : []).filter((d) => d && typeof d.text === 'string').map((d) => ({ age: num(d.age, 0, 120, 0), text: d.text.slice(0, 240) }));
      const cp = raw.capsule;
      s.capsule = cp && typeof cp.text === 'string' ? { text: cp.text.slice(0, 400), from: num(cp.from, 0, 120, 0), open: num(cp.open, 0, 120, 0), opened: !!cp.opened } : null;
      s.hist = (Array.isArray(raw.hist) ? raw.hist.slice(0, 400) : []).map((h) => {
        if (!h || typeof h !== 'object') return null;
        if (h.a) return ['home', 'item', 'pet', 'sell', 'capsule'].includes(h.a) ? { a: h.a, id: String(h.id || '').slice(0, 400), age: num(h.age, 0, 120, 0), y: h.y === undefined ? undefined : num(h.y, 0, 120, 0) } : null;
        return BY_ID[h.e] ? { e: h.e, c: String(h.c || '').slice(0, 20), g: Number.isFinite(h.g) ? clamp(h.g, 0, 1) : null, o: (Array.isArray(h.o) ? h.o : []).slice(0, 8).map((x) => String(x).slice(0, 20)), age: num(h.age, 0, 120, 0) } : null;
      }).filter(Boolean);
      VIRTUES.forEach((k) => { s.virtues[k] = num(raw.virtues && raw.virtues[k], -20, 50, 0); });
      const f = raw.flags && typeof raw.flags === 'object' ? raw.flags : {};
      Object.keys(f).slice(0, 60).forEach((k) => { const v = f[k]; if (typeof v === 'boolean' || (typeof v === 'string' && v.length <= 40) || (typeof v === 'number' && Number.isFinite(v))) s.flags[k] = v; });
      if (s.flags.job !== undefined && !JOBS[s.flags.job]) delete s.flags.job;
      const seen = raw.seen && typeof raw.seen === 'object' ? raw.seen : {};
      Object.keys(seen).forEach((k) => { if (BY_ID[k] && Number.isFinite(seen[k])) s.seen[k] = num(seen[k], 0, 120, 0); });
      const kinds = ['event', 'result', 'year'];
      (Array.isArray(raw.log) ? raw.log.slice(-60) : []).forEach((r) => { if (r && kinds.includes(r.kind)) s.log.push({ age: num(r.age, 0, 120, 0), kind: r.kind, text: String(r.text || '').slice(0, 300) }); });
      (Array.isArray(raw.memories) ? raw.memories.slice(-80) : []).forEach((m) => { if (m) s.memories.push({ age: num(m.age, 0, 120, 0), icon: String(m.icon || '').slice(0, 8), title: String(m.title || '').slice(0, 80), text: String(m.text || '').slice(0, 400) }); });
      if (raw.pending) {
        const ev = BY_ID[raw.pending.id];
        if (!ev) return null;
        s.pending = instantiate(ev, s); // rebuilt from the event table, so its text and choices cannot be forged
      } else if (s.over) { s.over = true; }
      return s;
    } catch (e) { return null; }
  }
  function summary(s) {
    const avg = (s.health + s.knowledge + s.happiness + s.relations) / 4;
    const vt = VIRTUES.reduce((a, k) => a + Math.max(0, s.virtues[k] || 0), 0);
    const dreamDone = !!(s.dream && DREAM_BY[s.dream].done(s));
    const score = clamp(Math.round(avg * 0.6 + clamp(vt * 2, 0, 20) + clamp(s.money / 250000, 0, 10) + (s.flags.children ? 5 : 0) + (s.flags.married ? 3 : 0) + (dreamDone ? 5 : 0)), 0, 100);
    const title = score >= 85 ? 'Kamyab aur nek insaan' : score >= 70 ? 'Khushhal aur sukoon wali zindagi' : score >= 50 ? 'Mehnati aur sabar wala musafir' : 'Seekhne wala musafir';
    const top = VIRTUES.filter((k) => (s.virtues[k] || 0) > 0).sort((x, y) => s.virtues[y] - s.virtues[x]).map((k) => ({ id: k, name: VIRTUE_NAMES[k], value: s.virtues[k] }));
    return { score, title, dream: s.dream ? DREAM_BY[s.dream].label : null, dreamDone, ageAtEnd: s.age, job: job(s) ? job(s).name : null, degree: DEGREE[s.flags.degree] || null, virtues: top, memories: s.memories.slice() };
  }


  // ---------- Butterfly Effect: replay a life with the same random numbers and one decision changed ----------
  const autoChoice = (s) => { const ch = s.pending.choices.find((x) => !x.locked && !x.game) || s.pending.choices.find((x) => !x.locked); return choose(s, ch.id); };
  const finishAuto = (s) => { for (let g = 0; g < 3000 && !s.over; g++) { if (s.pending) autoChoice(s); else advance(s); } return s; };
  function replay(proto, change) {
    const s = create({ name: proto.name, era: proto.era, seed: proto.seed0, dream: proto.dream, perks: proto.perks });
    for (let i = 0; i < proto.hist.length && !s.over; i++) {
      const h = proto.hist[i];
      if (h.a) {
        for (let g = 0; g < 400 && s.age < h.age && !s.over; g++) { if (s.pending) autoChoice(s); else advance(s); }
        act(s, h.a, h.id, { text: h.id, years: h.y });
        continue;
      }
      if (!s.pending) advance(s);
      if (s.over || !s.pending) break;
      let cid = h.c, g = h.g;
      if (change && change.i === i) { cid = change.choice; g = null; }
      if (!(s.pending.id === h.e && s.pending.choices.some((x) => x.id === cid && !x.locked))) { const alt = s.pending.choices.find((x) => !x.locked && !x.game) || s.pending.choices.find((x) => !x.locked); cid = alt.id; g = null; }
      choose(s, cid, g === null || g === undefined ? undefined : { score: g });
    }
    return s;
  }
  const fingerprint = (s) => JSON.stringify([s.rs, s.age, s.over, s.money, s.health, s.knowledge, s.happiness, s.relations, s.virtues, Object.assign({}, s.flags, { paid: undefined }), s.hn, s.hsum, s.endAge, s.home, s.items, s.pets, s.seen]);
  // verify(life): true only if replaying the saved decisions gives exactly this life. Used by the leaderboard so scores cannot be typed in.
  function verify(s) {
    try {
      if (!s || !s.over || s.seed0 === null || s.seed0 === undefined || !s.hist || !s.hist.length) return false;
      const r = replay(s);
      return r.over && fingerprint(r) === fingerprint(s);
    } catch (e) { return false; }
  }
  // alternatives(life): the decisions that had more than one open choice, with the choices (oldest first)
  function alternatives(s) {
    if (s.seed0 === null || s.seed0 === undefined || !s.hist) return [];
    const out = [];
    s.hist.forEach((h, i) => {
      if (h.a || !h.o || h.o.length < 2 || !BY_ID[h.e] || h.e === 'finale') return;
      const ev = BY_ID[h.e];
      out.push({ i, age: h.age, icon: ev.icon, title: ev.title, chosen: h.c, options: h.o.map((id) => { const c = ev.choices.find((x) => x.id === id); return { id, label: c ? c.label : id }; }) });
    });
    return out;
  }
  function compare(a, b) {
    const x = summary(a), y = summary(b);
    return { score: [x.score, y.score], age: [a.age, b.age], money: [a.money, b.money], job: [x.job, y.job], degree: [x.degree, y.degree], married: [!!a.flags.married, !!b.flags.married], children: [!!a.flags.children, !!b.flags.children], health: [a.health, b.health], happiness: [a.happiness, b.happiness] };
  }
  // whatIf(life, histIndex, choiceId) -> { life: the other life, cmp } (the rest of the life plays on with the saved decisions where they still fit)
  function whatIf(s, i, choiceId) {
    if (s.seed0 === null || s.seed0 === undefined) throw new Error('This life has no replay history');
    const h = s.hist[i]; if (!h || h.a || !h.o || !h.o.includes(choiceId)) throw new Error('Not an open decision');
    const alt = finishAuto(replay(s, { i, choice: choiceId }));
    return { life: alt, cmp: compare(s.over ? s : finishAuto(replay(s)), alt) };
  }

  return { STAGES, STATS, VIRTUES, VIRTUE_NAMES, ERAS, DEGREE, FIELD, JOBS, HOMES, ITEMS, PETS, PERKS, DREAMS, stageOf, fmtRs, create, choose, advance, restore, summary, monthlyBase, price, act, addDiary, diaryEntries, familyTree, goals, homeTier, rentOf, verify, replay, alternatives, whatIf, compare, fingerprint };
});
