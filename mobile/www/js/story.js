// "Aaj ki kahani": one motivational story per day. A film-style intro, then the story is told chapter by chapter and every
// chapter is a real task in the Live World (walk, talk, collect, wave...). The ending card shows the moral.
// Pure data + a small DOM layer; the tasks themselves run on the mission engine in extras.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null); else root.TimeWarpStory = factory(root);
})(typeof self !== 'undefined' ? self : this, function (win) {
  // chapter: { line: what the narrator says, type: mission type, goal, place: where (mosque | centre | nw | ne | sw | se | shopN), task: what to do }
  const STORIES = [
    { id: 'small-steps', icon: '👣', title: 'Chhota Qadam, Bara Safar', hero: 'Ali',
      intro: ['Ali ko apne bare khwab se darr lagta tha.', 'Wo sochta tha: "Itna bara kaam main akela kaise karun?"', 'Aaj usne faisla kiya: sirf ek chhota qadam.'],
      chapters: [
        { line: 'Ali ne ghar se nikal kar shehar ke markaz ki taraf pehla qadam uthaya. Pehla qadam hamesha sab se mushkil hota hai.', type: 'goto', place: 'centre', task: 'Pehla qadam: chal kar wahan pohnchein' },
        { line: 'Raste mein logon ne usay hausla diya: "Koshish karne walon ki kabhi haar nahi hoti."', type: 'talk', goal: 2, task: 'Do logon se baat karein (unke paas ja kar E dabayen)' },
        { line: 'Ali ne dekha, har chhota qadam ek sikka hai. Jitne sikke jama honge, utna hausla barhe ga.', type: 'coins', goal: 5, place: 'centre', task: '5 sikke jama karein' },
        { line: 'Shaam ko Ali masjid pohcha aur Allah ka shukar ada kiya. Aaj usne apna safar shuru kar diya tha.', type: 'goto', place: 'mosque', task: 'Shukar ke liye chal kar wahan pohnchein' } ],
      moral: 'Bare khwab chhote qadamon se poore hote hain. Aaj bas ek qadam uthao.' },
    { id: 'fall-rise', icon: '🚲', title: 'Girna Haar Nahi', hero: 'Bilal',
      intro: ['Bilal ne pehli baar cycle seekhni shuru ki.', 'Wo chaar baar gira. Dost hans pare.', 'Magar Bilal ne haar nahi mani.'],
      chapters: [
        { line: 'Bilal cycle le kar dukan ki taraf chala, jahan uske dost intezar kar rahe thay.', type: 'goto', place: 'shop0', task: 'Dukan ke darwaze tak jayen' },
        { line: 'Har baar girne ke baad Bilal utha, muskuraya aur haath hilaya: "Main theek hoon!"', type: 'wave', goal: 3, task: '3 baar haath hilayen (key 1)' },
        { line: 'Phir wo lamha aaya jab balance ban gaya. Bilal khushi se jhoom utha!', type: 'dance', goal: 1, task: 'Khushi mein naachein (key 2)' },
        { line: 'Ab Bilal poori sarak par cycle chala sakta tha. Jo kal mushkil tha, aaj aasan tha.', type: 'goto', place: 'se', task: 'Sarak ke doosre kinare tak jayen' } ],
      moral: 'Girna haar nahi hai. Girne ke baad na uthna haar hai.' },
    { id: 'hard-work', icon: '🏪', title: 'Mehnat ka Phal', hero: 'Rashid',
      intro: ['Rashid ke paas sirf ek chhoti si dukan thi.', 'Log kehte thay: "Is se kuch nahi hone wala."', 'Rashid ne har din thori si mehnat ki.'],
      chapters: [
        { line: 'Subah sab se pehle Rashid ne dukan ka darwaza khola. Mehnat dukan kholne se shuru hoti hai.', type: 'shop', goal: 1, task: 'Kisi dukan mein dakhil hon (darwaze par E)' },
        { line: 'Usne gahak se achhe akhlaq se baat ki, kyunke bharosa sab se bari poonji hai.', type: 'talk', goal: 1, task: 'Dukandar ya kisi se baat karein (E)' },
        { line: 'Ek gahak ne khareedari ki aur Rashid ki pehli kamai hui. Pehli kamai ki khushi sab se meethi hoti hai.', type: 'buy', goal: 1, task: 'Dukan se ek cheez khareedein' },
        { line: 'Saalon baad Rashid ki dukan shehar ki sab se mashhoor dukan thi. Wo roz markaz ki taraf se guzarta tha, shukar ke saath.', type: 'goto', place: 'centre', task: 'Markaz tak chal kar jayen' } ],
      moral: 'Mehnat kabhi zaya nahi jati. Aaj ki chhoti mehnat kal ki bari kamyabi hai.' },
    { id: 'kindness', icon: '🤝', title: 'Madad ka Jazba', hero: 'Sana',
      intro: ['Sana ko lagta tha ke ek akeli ladki kya badal sakti hai.', 'Phir usne ek mushkil mein phanse shakhs ki madad ki.', 'Aaj Sana ne seekha: neki phailti hai.'],
      chapters: [
        { line: 'Sana ne chalte hue dekha ke kuch log pareshan hain. Usne un se haal poocha.', type: 'talk', goal: 3, task: '3 logon se baat karein (E)' },
        { line: 'Uski muskurahat se logon ka din behtar ho gaya. Ek muskurahat bhi sadqa hai.', type: 'wave', goal: 2, task: '2 baar salaam ke liye haath hilayen (key 1)' },
        { line: 'Sana ne is din ki ek yaad tasveer mein mehfooz kar li.', type: 'photo', goal: 1, task: 'Photo button se ek tasveer lein' },
        { line: 'Raat ko Sana ko ehsaas hua: jis ne ek insaan ki madad ki, us ne poori duniya badal di.', type: 'goto', place: 'shop1', task: 'Dukan ke darwaze tak jayen' } ],
      moral: 'Chhoti si neki bhi kisi ki poori kahani badal sakti hai.' },
    { id: 'patience', icon: '🌱', title: 'Sabar ka Meetha Phal', hero: 'Usman',
      intro: ['Usman ne ek chhota sa paudha lagaya.', 'Roz paani diya, magar kuch nazar nahi aaya.', 'Usman ne sabar nahi chhora.'],
      chapters: [
        { line: 'Usman paudhe ke liye behtareen jagah dhoondne chala. Sahi jagah dhoondna bhi mehnat hai.', type: 'goto', place: 'nw', task: 'Door wale chowk tak jayen' },
        { line: 'Raaste mein usay zameen par sunehri beej jaise sikke milay. Har sikka sabar ka inaam tha.', type: 'coins', goal: 6, place: 'ne', task: '6 sikke jama karein' },
        { line: 'Ek hafte baad kopal phooti. Usman khushi se ro pada.', type: 'dance', goal: 1, task: 'Khushi mein naachein (key 2)' },
        { line: 'Saal bhar baad wo paudha ghana darakht ban gaya. Sabar ka phal hamesha meetha hota hai.', type: 'goto', place: 'mosque', task: 'Shukar ke liye chal kar wahan pohnchein' } ],
      moral: 'Jo cheez aaj nazar nahi aa rahi, wo bhi barh rahi hai. Sabar karo.' },
  ];

  // Voice versions: the browser's Hindi voice reads Devanagari well, and spoken Hindi and Urdu are the same language. Subtitles stay in Roman Urdu.
  const DEVA = {
   "Ali ko apne bare khwab se darr lagta tha.": "अली को अपने बड़े ख़्वाब से डर लगता था।",
   "Wo sochta tha: \"Itna bara kaam main akela kaise karun?\"": "वो सोचता था: \"इतना बड़ा काम मैं अकेला कैसे करूँ?\"",
   "Aaj usne faisla kiya: sirf ek chhota qadam.": "आज उसने फ़ैसला किया: सिर्फ़ एक छोटा क़दम।",
   "Ali ne ghar se nikal kar shehar ke markaz ki taraf pehla qadam uthaya. Pehla qadam hamesha sab se mushkil hota hai.": "अली ने घर से निकल कर शहर के मरकज़ की तरफ़ पहला क़दम उठाया। पहला क़दम हमेशा सब से मुश्किल होता है।",
   "Raste mein logon ne usay hausla diya: \"Koshish karne walon ki kabhi haar nahi hoti.\"": "रास्ते में लोगों ने उसे हौसला दिया: \"कोशिश करने वालों की कभी हार नहीं होती।\"",
   "Ali ne dekha, har chhota qadam ek sikka hai. Jitne sikke jama honge, utna hausla barhe ga.": "अली ने देखा, हर छोटा क़दम एक सिक्का है। जितने सिक्के जमा होंगे, उतना हौसला बढ़ेगा।",
   "Shaam ko Ali masjid pohcha aur Allah ka shukar ada kiya. Aaj usne apna safar shuru kar diya tha.": "शाम को अली मस्जिद पहुँचा और अल्लाह का शुक्र अदा किया। आज उसने अपना सफ़र शुरू कर दिया था।",
   "Bare khwab chhote qadamon se poore hote hain. Aaj bas ek qadam uthao.": "बड़े ख़्वाब छोटे क़दमों से पूरे होते हैं। आज बस एक क़दम उठाओ।",
   "Bilal ne pehli baar cycle seekhni shuru ki.": "बिलाल ने पहली बार साइकिल सीखनी शुरू की।",
   "Wo chaar baar gira. Dost hans pare.": "वो चार बार गिरा। दोस्त हँस पड़े।",
   "Magar Bilal ne haar nahi mani.": "मगर बिलाल ने हार नहीं मानी।",
   "Bilal cycle le kar dukan ki taraf chala, jahan uske dost intezar kar rahe thay.": "बिलाल साइकिल लेकर दुकान की तरफ़ चला, जहाँ उसके दोस्त इंतज़ार कर रहे थे।",
   "Har baar girne ke baad Bilal utha, muskuraya aur haath hilaya: \"Main theek hoon!\"": "हर बार गिरने के बाद बिलाल उठा, मुस्कुराया और हाथ हिलाया: \"मैं ठीक हूँ!\"",
   "Phir wo lamha aaya jab balance ban gaya. Bilal khushi se jhoom utha!": "फिर वो लम्हा आया जब बैलेंस बन गया। बिलाल ख़ुशी से झूम उठा!",
   "Ab Bilal poori sarak par cycle chala sakta tha. Jo kal mushkil tha, aaj aasan tha.": "अब बिलाल पूरी सड़क पर साइकिल चला सकता था। जो कल मुश्किल था, आज आसान था।",
   "Girna haar nahi hai. Girne ke baad na uthna haar hai.": "गिरना हार नहीं है। गिरने के बाद न उठना हार है।",
   "Rashid ke paas sirf ek chhoti si dukan thi.": "राशिद के पास सिर्फ़ एक छोटी सी दुकान थी।",
   "Log kehte thay: \"Is se kuch nahi hone wala.\"": "लोग कहते थे: \"इस से कुछ नहीं होने वाला।\"",
   "Rashid ne har din thori si mehnat ki.": "राशिद ने हर दिन थोड़ी सी मेहनत की।",
   "Subah sab se pehle Rashid ne dukan ka darwaza khola. Mehnat dukan kholne se shuru hoti hai.": "सुबह सब से पहले राशिद ने दुकान का दरवाज़ा खोला। मेहनत दुकान खोलने से शुरू होती है।",
   "Usne gahak se achhe akhlaq se baat ki, kyunke bharosa sab se bari poonji hai.": "उसने ग्राहक से अच्छे अख़लाक़ से बात की, क्योंकि भरोसा सब से बड़ी पूँजी है।",
   "Ek gahak ne khareedari ki aur Rashid ki pehli kamai hui. Pehli kamai ki khushi sab se meethi hoti hai.": "एक ग्राहक ने ख़रीदारी की और राशिद की पहली कमाई हुई। पहली कमाई की ख़ुशी सब से मीठी होती है।",
   "Saalon baad Rashid ki dukan shehar ki sab se mashhoor dukan thi. Wo roz markaz ki taraf se guzarta tha, shukar ke saath.": "सालों बाद राशिद की दुकान शहर की सब से मशहूर दुकान थी। वो रोज़ मरकज़ की तरफ़ से गुज़रता था, शुक्र के साथ।",
   "Mehnat kabhi zaya nahi jati. Aaj ki chhoti mehnat kal ki bari kamyabi hai.": "मेहनत कभी ज़ाया नहीं जाती। आज की छोटी मेहनत कल की बड़ी कामयाबी है।",
   "Sana ko lagta tha ke ek akeli ladki kya badal sakti hai.": "सना को लगता था कि एक अकेली लड़की क्या बदल सकती है।",
   "Phir usne ek mushkil mein phanse shakhs ki madad ki.": "फिर उसने एक मुश्किल में फँसे शख़्स की मदद की।",
   "Aaj Sana ne seekha: neki phailti hai.": "आज सना ने सीखा: नेकी फैलती है।",
   "Sana ne chalte hue dekha ke kuch log pareshan hain. Usne un se haal poocha.": "सना ने चलते हुए देखा कि कुछ लोग परेशान हैं। उसने उन से हाल पूछा।",
   "Uski muskurahat se logon ka din behtar ho gaya. Ek muskurahat bhi sadqa hai.": "उसकी मुस्कुराहट से लोगों का दिन बेहतर हो गया। एक मुस्कुराहट भी सदक़ा है।",
   "Sana ne is din ki ek yaad tasveer mein mehfooz kar li.": "सना ने इस दिन की एक याद तस्वीर में महफ़ूज़ कर ली।",
   "Raat ko Sana ko ehsaas hua: jis ne ek insaan ki madad ki, us ne poori duniya badal di.": "रात को सना को एहसास हुआ: जिस ने एक इंसान की मदद की, उस ने पूरी दुनिया बदल दी।",
   "Chhoti si neki bhi kisi ki poori kahani badal sakti hai.": "छोटी सी नेकी भी किसी की पूरी कहानी बदल सकती है।",
   "Usman ne ek chhota sa paudha lagaya.": "उस्मान ने एक छोटा सा पौधा लगाया।",
   "Roz paani diya, magar kuch nazar nahi aaya.": "रोज़ पानी दिया, मगर कुछ नज़र नहीं आया।",
   "Usman ne sabar nahi chhora.": "उस्मान ने सब्र नहीं छोड़ा।",
   "Usman paudhe ke liye behtareen jagah dhoondne chala. Sahi jagah dhoondna bhi mehnat hai.": "उस्मान पौधे के लिए बेहतरीन जगह ढूँढने चला। सही जगह ढूँढना भी मेहनत है।",
   "Raaste mein usay zameen par sunehri beej jaise sikke milay. Har sikka sabar ka inaam tha.": "रास्ते में उसे ज़मीन पर सुनहरी बीज जैसे सिक्के मिले। हर सिक्का सब्र का इनाम था।",
   "Ek hafte baad kopal phooti. Usman khushi se ro pada.": "एक हफ़्ते बाद कोंपल फूटी। उस्मान ख़ुशी से रो पड़ा।",
   "Saal bhar baad wo paudha ghana darakht ban gaya. Sabar ka phal hamesha meetha hota hai.": "साल भर बाद वो पौधा घना दरख़्त बन गया। सब्र का फल हमेशा मीठा होता है।",
   "Jo cheez aaj nazar nahi aa rahi, wo bhi barh rahi hai. Sabar karo.": "जो चीज़ आज नज़र नहीं आ रही, वो भी बढ़ रही है। सब्र करो।"
  };
  const HERO = { Ali: 'अली', Bilal: 'बिलाल', Rashid: 'राशिद', Sana: 'सना', Usman: 'उस्मान' };
  const dayNumber = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  const today = (d) => STORIES[((dayNumber(d) % STORIES.length) + STORIES.length) % STORIES.length];
  const API = { STORIES, today, dayNumber };
  // the closing lines: { t: subtitle, v: voice }
  API.finaleLines = (d, bonus) => [
    { t: 'Shabash! Tum ne ' + d.hero + ' ki kahani apne qadamon se poori ki.', v: 'शाबाश! तुमने ' + (HERO[d.hero] || d.hero) + ' की कहानी अपने क़दमों से पूरी की।' },
    { t: 'Sabaq: ' + d.moral, v: 'सबक़: ' + (DEVA[d.moral] || d.moral) },
    bonus ? { t: `Inaam: +Rs ${bonus}. Kal nayi kahani tumhara intezar karegi.`, v: `इनाम: ${bonus} रुपये। कल नई कहानी तुम्हारा इंतज़ार करेगी।` } : { t: 'Kal nayi kahani tumhara intezar karegi.', v: 'कल नई कहानी तुम्हारा इंतज़ार करेगी।' } ];
  if (!win) return API;

  const KEY = 'timewarp-story-done';
  API.doneToday = () => { try { return localStorage.getItem(KEY) === String(dayNumber()); } catch (e) { return false; } };
  API.markDone = () => { try { localStorage.setItem(KEY, String(dayNumber())); } catch (e) { /* ignore */ } };

  // ---------- narration (browser voice, only if it has an Urdu / Hindi voice; otherwise just subtitles) ----------
  let voiceList = [];
  const loadVoices = () => { try { voiceList = win.speechSynthesis.getVoices() || []; } catch (e) { voiceList = []; } return voiceList; };
  try { if (win.speechSynthesis) { loadVoices(); win.speechSynthesis.addEventListener('voiceschanged', loadVoices); } } catch (e) { /* no speech */ }
  const pickVoice = () => { const vs = voiceList.length ? voiceList : loadVoices(); return vs.find((x) => /^hi/i.test(x.lang) && /google|microsoft|natural|neural/i.test(x.name)) || vs.find((x) => /^hi/i.test(x.lang)) || null; };
  API.hasVoice = () => !!pickVoice();
  function speak(text) {          // text: a line ({t, v} or the Roman Urdu string)
    try {
      const vt = document.getElementById('voice-toggle'); if (vt && /off/i.test(vt.textContent)) return;
      const s = win.speechSynthesis; if (!s) return;
      const say = typeof text === 'string' ? (DEVA[text] || null) : (text.v || DEVA[text.t] || null);
      const v = pickVoice(); if (!v || !say) return;
      s.cancel(); const u = new SpeechSynthesisUtterance(say); u.voice = v; u.lang = v.lang; u.rate = 0.9; u.pitch = 1; s.speak(u);
    } catch (e) { /* no voice: subtitles only */ }
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const host = () => document.getElementById('world') || document.body;
  function type(node, text, ms, done) {      // typewriter
    let i = 0; node.textContent = ''; clearInterval(node._t);
    node._t = setInterval(() => { node.textContent = text.slice(0, ++i); if (i >= text.length) { clearInterval(node._t); if (done) done(); } }, ms);
  }

  // ---------- full-screen "film" card: title, narrated lines, ending ----------
  let cine = null;
  API.cinematic = function (opt, onDone) {   // opt: { icon, title, sub, lines[], final, moral, reward }
    if (cine) cine.close();
    const box = el('div', 'story-cine' + (opt.final ? ' final' : '')); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', opt.title);
    const bt = el('i', 'bar top'), bb = el('i', 'bar bottom'), ic = el('div', 'sc-icon', opt.icon || '📖'), ti = el('h2', 'sc-title', opt.title), su = el('p', 'sc-sub', opt.sub || ''), tx = el('p', 'sc-text', '');
    const skip = el('button', 'btn ghost sc-skip', 'Aage ▶'); skip.type = 'button';
    box.append(bt, bb, ic, ti, su, tx, skip); host().appendChild(box);
    let timer = 0, closed = false, step = -1;
    const lines = opt.lines || [];
    const close = () => { if (closed) return; closed = true; clearTimeout(timer); try { win.speechSynthesis && win.speechSynthesis.cancel(); } catch (e) { /* ignore */ } box.classList.add('out'); setTimeout(() => box.remove(), 500); cine = null; if (onDone) onDone(); };
    const next = () => {
      clearTimeout(timer); step++;
      if (step >= lines.length) { if (opt.final) { tx.textContent = ''; } close(); return; }
      const L = lines[step], ln = typeof L === 'string' ? L : L.t; speak(L); type(tx, ln, 38);
      timer = setTimeout(next, Math.max(2600, ln.length * 85));
    };
    skip.addEventListener('click', next);
    if (opt.final) { ti.textContent = opt.title; su.textContent = opt.sub || ''; }
    timer = setTimeout(next, 1800);           // the title is shown first
    cine = { close }; return cine;
  };

  // ---------- narration caption at the bottom while you play a chapter ----------
  let cap = null, capT = 0;
  API.caption = function (text) {
    if (!cap) { cap = el('p', 'story-caption'); cap.setAttribute('role', 'status'); host().appendChild(cap); }
    cap.hidden = false; cap.classList.add('show'); type(cap, '📖 ' + text, 28); speak(text);
    clearTimeout(capT); capT = setTimeout(() => { if (cap) cap.classList.remove('show'); }, Math.max(9000, text.length * 110));
  };
  API.hideCaption = function () { if (cap) cap.classList.remove('show'); try { win.speechSynthesis && win.speechSynthesis.cancel(); } catch (e) { /* ignore */ } };

  // ---------- the button ----------
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.getElementById('story-btn'); if (!b) return;
    const t = today(); b.title = `Aaj ki kahani: ${t.title}`;
    setTimeout(() => { if (!API.hasVoice()) b.title += ' · (is browser mein Hindi/Urdu awaaz nahi mili: sirf subtitles)'; }, 1500);
    b.addEventListener('click', () => { if (win.__tw && win.__tw.X && win.__tw.X.startStory) win.__tw.X.startStory(); else b.textContent = '📖 Thora ruko…'; });
  });
  return API;
});
