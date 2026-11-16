// What people in the Live World say: names, small talk lines, answers to what the visitor types or says,
// shop price lists. Rule-based on purpose (works offline, no account needed). English plus common Roman Urdu words.
(function (root) {
  const NAMES = {
    past: ['Ahmad', 'Bashir', 'Chiragh', 'Dilawar', 'Fazal', 'Ghulam', 'Hakeem', 'Ilyas', 'Jamil', 'Karam', 'Latif', 'Maqbool'],
    present: ['Ali', 'Sara', 'Hamza', 'Ayesha', 'Bilal', 'Zainab', 'Usman', 'Hira', 'Imran', 'Noor', 'Fahad', 'Maryam'],
    future: ['Zed', 'Nova', 'Kai', 'Lyra', 'Orin', 'Vex', 'Mira', 'Axel', 'Sol', 'Juno', 'Rex', 'Ila'],
  };
  const CHAT = {
    past: ['The bazaar is busy today.', 'Have you tasted the fresh halwa?', 'The tonga fares have gone up.', 'Peace be upon you, friend.', 'The harvest looks promising.', 'Come, let us have some chai.', 'Did you hear the town crier?', 'The days are getting shorter.'],
    present: ['Did you try the new cafe?', 'The traffic is terrible today.', 'Nice weather, is it not?', 'Have you seen the news?', 'I am late for work!', 'Prices keep going up.', 'Let us grab some tea.', 'How is your family?'],
    future: ['Did you see that sky lane jam?', 'My jetpack battery is low.', 'The neon noodles are great!', 'The year moves so fast.', 'Robo Repair fixed my drone.', 'Is the Data Cafe open?', 'The air taxis are late again.', 'I love the hover lanes at night.'],
  };
  const FLAVOR = {
    past: { weather: 'The sun is mild today, good for the market.', busy: 'The tonga drivers are busy today.', era: 'Times are slow and good here. News travels by word of mouth.' },
    present: { weather: 'Fine weather, though the traffic is heavy.', busy: 'The roads are packed as always.', era: 'Everyone is on their phone these days.' },
    future: { weather: 'The climate domes keep it pleasant all day.', busy: 'The sky lanes are busy at this hour.', era: 'The future moves fast. Flying to work is normal now.' },
  };
  const ITEMS = {
    cafe: [['Tea', 80], ['Coffee', 150], ['Cake slice', 200]], bakery: [['Bread', 60], ['Cookies', 120], ['Birthday cake', 450]],
    pharmacy: [['Bandages', 90], ['Vitamins', 250], ['Cough syrup', 180]], 'mobile shop': [['Phone charger', 400], ['Earbuds', 700], ['Phone case', 300]],
    tailor: [['Stitching a shirt', 800], ['Scarf', 300], ['Button repair', 50]], grocery: [['Rice 1 kg', 300], ['Milk', 180], ['Fruit basket', 350]],
    books: [['Novel', 450], ['Notebook', 120], ['Pen set', 200]], barber: [['Haircut', 250], ['Shave', 150]],
    halwai: [['Jalebi', 40], ['Halwa', 90], ['Barfi box', 200]], pansari: [['Spice mix', 60], ['Dried fruit', 140], ['Herbs', 50]],
    sarai: [['Hot meal', 50], ['Night stay', 100], ['Fresh water', 5]], hakeem: [['Herbal tonic', 70], ['Honey', 90]], darzi: [['Kurta stitching', 120], ['Cap', 40]],
    'chai khana': [['Chai', 10], ['Paratha', 30], ['Biscuits', 15]], 'kulfa house': [['Kulfi', 25], ['Falooda', 60]], sarraf: [['Silver ring', 400], ['Bangle', 600]],
    'hover garage': [['Battery pack', 900], ['Hover tuning', 1200]], 'neon noodles': [['Noodle bowl', 220], ['Glow soda', 90]], 'robo repair': [['Drone repair', 700], ['Sensor chip', 350]],
    'data cafe': [['Synth coffee', 160], ['Memory snack', 120]], 'holo mart': [['Holo lamp', 650], ['Pocket pet hologram', 300]], 'sky pharmacy': [['Nano bandage', 180], ['Energy patch', 260]],
  };
  const SPEECH = { '!': 'Hey! Stop that!', 'STOP!': 'Stop! Police!', Rs: 'Here you go.' };

  const items = (shopName) => (ITEMS[String(shopName || '').toLowerCase()] || [['Local snack', 100], ['Souvenir', 250]]).map(([name, price]) => ({ name, price }));
  const nameFor = (era, id) => (NAMES[era] || NAMES.present)[id % (NAMES[era] || NAMES.present).length];
  const chatLines = (era) => CHAT[era] || CHAT.present;
  const suggestions = (role) => role === 'keeper' ? ['Hello', 'What do you sell?', 'How much is it?', 'Goodbye']
    : role === 'police' ? ['Hello', 'Is it safe here?', 'Where am I?', 'Goodbye']
    : ['Hello', 'What year is it?', 'Where can I eat?', 'Tell me about this place', 'Goodbye'];

  function greeting(o, rand) {
    const pick = (a) => a[Math.floor(rand() * a.length) % a.length];
    const hi = { past: ['Assalam-o-alaikum!', 'Peace be with you!'], present: ['Hello there!', 'Hi! Nice to meet you.'], future: ['Greetings, traveller!', 'Welcome to the year ' + (o.year || 'ahead') + '!'] }[o.era] || ['Hello!'];
    const tail = o.role === 'keeper' ? ' Welcome to my shop.' : o.role === 'police' ? ' Keep the peace, please.' : '';
    return pick(hi) + tail;
  }

  // o: { role, era, text, name, year, yearLabel, place, shopNames[], items[] }
  function reply(o, rand = Math.random) {
    const t = String(o.text || '').toLowerCase().trim(), era = FLAVOR[o.era] ? o.era : 'present', F = FLAVOR[era];
    const pick = (a) => a[Math.floor(rand() * a.length) % a.length];
    const is = (re) => re.test(t);
    const shops = (o.shopNames && o.shopNames.length ? o.shopNames : ['the shops on this street']).slice(0, 3).join(', ');
    if (!t) return pick(['Yes?', 'I am listening.']);
    if (is(/\b(bye|goodbye|see you|khuda hafiz|allah hafiz|alvida|chalta hoon)\b|خدا حافظ|اللہ حافظ/)) return pick(['Goodbye! Take care.', 'See you around!', 'Allah hafiz!']);
    if (is(/\b(thank|thanks|shukriya|shukria|meherbani)\b|شکریہ/)) return pick(['You are welcome!', 'No problem at all.', 'Any time!']);
    if (is(/\b(hello|hi|hey|salam|salaam|assalam|assalamu|namaste|aoa)\b|سلام/)) return greeting(o, rand);
    if (is(/how are you|how do you do|kaise ho|kese ho|kaisay ho|kya haal|aap kaise|how is it going/)) return pick(['I am well, thank you. And you?', 'Doing fine, thanks for asking.', 'Alhamdulillah, all good.']);
    if (is(/your name|who are you|aap ka naam|tumhara naam|naam kya|apna naam/)) return `My name is ${o.name}. ${o.role === 'keeper' ? 'I run this shop.' : o.role === 'police' ? 'I am an officer on patrol.' : 'I live around here.'}`;
    if (is(/what year|which year|the year|what is the date|today.?s date|saal|kaun sa saal|konsa saal|kitni tarikh/)) return `It is the year ${o.yearLabel || o.year}.`;
    if (is(/where am i|which city|this place|about this|tell me about|kahan|kaun si jagah|konsi jagah|city|shehar/)) return `You are in ${o.place}. ${F.era}`;
    if (o.role === 'keeper' && is(/price|cost|how much|kitne|kitna|rate|menu|sell|items|what do you have|kya hai/)) {
      const list = (o.items || []).map((i) => `${i.name} for Rs ${i.price}`).join(', ');
      return list ? `I have ${list}. Come to the counter and press Buy.` : 'Have a look around, everything is priced.';
    }
    if (is(/\b(hungry|food|eat|bhook|khana|restaurant|tea|chai|coffee)\b/)) return `Try ${shops}. They are close by.`;
    if (is(/\b(shops?|store|dukan|dukaan|buy|kharid|market|bazaar|bazar|shopping)\b/)) return `There is ${shops} nearby. You can walk right in.`;
    if (is(/\b(police|thana|help|danger|safe|fight|jhagda|ladai|crime)\b/)) return o.role === 'police' ? 'It is safe as long as everyone keeps the peace. Do not start fights, and we will not have a problem.' : 'Police patrol this street. Please do not start any trouble.';
    if (is(/\b(weather|mausam|rain|sunny|garmi|sardi|hot|cold)\b/)) return F.weather;
    if (is(/\b(traffic|busy|roads?|sadak|gaari)\b/)) return F.busy;
    if (is(/\b(future|2050|2100|tomorrow|agay)\b|aane wala/)) return era === 'future' ? 'You are standing in it. Look up, people fly now!' : 'They say the cities will glow and people will fly one day. Who knows?';
    if (is(/\b(past|history|purana|pehle|guzra)\b|old days/)) return era === 'past' ? 'You are standing in it, friend. Enjoy the bazaar.' : 'Those were different times. Slower, they say.';
    if (is(/\b(job|work|kaam|business|karobar|profession)\b|what do you do/)) return o.role === 'keeper' ? 'I keep this shop open every day. Business is steady.' : o.role === 'police' ? 'I walk the beat and keep the street calm.' : 'I do a bit of everything. Today I am just out walking.';
    if (is(/\b(joke|funny|mazak|latifa|mazaq)\b/)) return pick(['Why did the clock go to school? To learn about time!', 'I would tell you a time travel joke, but you did not like it yesterday.']);
    if (is(/\b(yes|yeah|ok|okay|sure|haan|ji)\b/)) return pick(['Good, good.', 'Alright then!']);
    return pick(['Sorry, I did not catch that. Ask me about the city, the shops or the year.', 'Hmm, I am not sure. Try asking about this place or the shops.']);
  }

  const api = { NAMES, SPEECH, items, nameFor, chatLines, suggestions, greeting, reply };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TimeWarpDialogue = api;
})(typeof window !== 'undefined' ? window : globalThis);
