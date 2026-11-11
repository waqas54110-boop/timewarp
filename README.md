# TimeWarp – 3D Time Travel Website

Node.js · Express 5 · EJS · Three.js · PostgreSQL

## Setup
```bash
npm install
cp .env.example .env          # then edit DATABASE_URL and SESSION_SECRET
createdb timewarp             # or create the DB from pgAdmin
npm run migrate               # create tables
npm run seed                  # sample eras, destinations, events, scenarios, quiz (RESETS content tables)
npm run dev                   # http://localhost:3000
```

Make yourself an admin: register on the site, then
```bash
npm run make-admin -- you@example.com admin     # or "editor"
```
Log out and in again so the session picks up the new role, then open `/admin`.

## Tests
`npm test` (needs the migrated + seeded database from `.env`; tests create and remove their own users).

## What's included
- 3D Three.js portal (Past/Present/Future colours, warp transition, pause button, no-WebGL CSS fallback, reduced-motion support)
- Immersive full-screen scene after time travel (image/video/generated animation); event cards sit behind a "Show details" button
- Travel engine with server-side validation (`/travel?mode=&year=&destinationId=`)
- Past, Present, Future explorers, Timeline, Search, Compare Then & Now, Quiz (server-side scoring)
- Accounts (bcrypt, session regeneration, CSRF, rate-limited login), saved journeys with ownership checks
- Admin CRUD for events, destinations, future scenarios + audit log (editor: create/edit, admin: delete)
- REST API exactly as in the documentation (`/api/...`)
- Helmet CSP, parameterized SQL, zod validation

## Before public launch
- Add licensed / public-domain images and sources for every event (`image_url`, `media` table).
- Review and expand the seed content; every historical entry needs a reliable source.
- Set `NODE_ENV=production`, a long `SESSION_SECRET`, HTTPS (reverse proxy), DB backups.

## Immersive scene (after time travel)
`/travel` opens a full-screen scene first; the events/scenarios are in the **Show details** sheet.
Scene source, in order: a row in `scenes` matching mode + year (+ destination) -> an event/destination `image_url` -> a generated animated scene (works with no media at all).
- Re-run `npm run migrate` once to create the `scenes` table.
- Put your own licensed files in `public/media/` and add rows (see the commented example at the end of `database/seed.sql`). Videos should be short, muted-friendly loops (MP4/H.264, ideally under 10 MB).
- Future scenes always show a "Speculative scenario" badge. Reduced-motion users get a still frame; Pause/Sound buttons are in the top bar.

## v2 features
Run `npm install` (adds `ws`) and `npm run migrate` once; run `npm run seed` to add globe coordinates for the sample places.

- **Time Globe** (`/globe`): 3D globe with a year slider; pins are places with coordinates (`destinations.latitude/longitude`). Click a pin or a list entry, then open the scene. Optional real map: put an equirectangular image at `public/media/earth.jpg`.
- **3D walkthrough** (`/explore?mode=&year=&destinationId=`): first-person generated city per era (drag to look, WASD/arrows or on-screen pad to walk). To use your own model, add a `.glb` to `public/media/` and set `scenes.model_url` (see the commented example in `database/seed.sql`). Use only models you are licensed to use.
- **Time Party**: on a scene press "Time Party" -> "Start a party" and share the invite link. Same-scene visitors see each other's cursors and chat live (WebSocket `/ws/party`, in memory only, max 12 per room, same-origin only). Signed-in users appear with their username, guests as Guest-xxxx.
- **Achievements** (`/leaderboard`, My journeys): badges (first jump, each era, all three time modes, 3/7-day streaks, quiz ace/perfect), streaks, and an all-time / this-month leaderboard. Points = 10 per badge + 5 per best quiz score + 1 per journey. Progress is stored for signed-in users only.

Tests: `npm test` (new `tests/party_achievements.test.js` needs no database).

## Live World (`/world`)
Third-person walk (like a game character) through a living street of the chosen era: working shops with signs and OPEN boards, other people walking the sidewalks and crossing roads, traffic (cars/buses now, horse-drawn tongas in the past, hover pods in the future).
- Press **Your look**, choose a photo of your face and it is mapped onto your avatar's head (use the sliders to fit it). The photo is processed in the browser only: never uploaded or stored. Use your own photo or someone's who agreed.
- **See my face** turns the camera to the front. Drag = camera, WASD/arrows = walk, Shift = run, wheel = zoom.
- It is a stylised 3D world, not photographs. For a more real look, drop an equirectangular panorama at `public/media/sky-<past|present|future>.jpg` (it becomes the sky).
- Roughly 1,500 draw calls: smooth on a normal laptop, heavier on old phones.

### Street life in the Live World
- People **chat** when they meet, and sometimes a **scuffle** breaks out (a cartoon shoving match). **Police** on patrol run to it along the sidewalks, break it up, warn the two people and let them go. A line at the bottom tells what just happened. Without police nearby a scuffle calms down by itself.
- **Shopkeepers** stand at 14 shops; shoppers walk up, hand over money (Rs bubble) and walk on. Police cars with flashing lights drive around in the present and the future.
- **Fly to 2050** (top bar) jumps to the future street, where a dozen people fly with jetpacks above the roads. **Back to <year>** returns.
- The behaviour logic lives in `public/js/social.js` and is covered by `tests/social.test.js`; `world.js` only draws it.

### Going inside, fighting, talking (Live World)
- **E** talks to the person next to you, or enters the shop door you stand at. Inside there is a furnished room with a counter and a shopkeeper: **E** at the counter opens the talk window with **Buy** buttons (you start with Rs 1000; your bag shows in the top right). **E** at the door leaves.
- **F** starts a cartoon scuffle with the nearest person (nobody gets hurt). Police run to you, warn you, and the other person goes back to their day. Walk away early and it simply ends. Picking a fight inside a shop makes the shopkeeper call the police, who walk you out after a few seconds.
- **Talking**: type, tap a suggested question, or press **Speak** (browser speech recognition: English / Urdu / Hindi; Chrome sends the audio to Google and asks for the microphone first). People answer in a spoken voice (your browser's built-in text-to-speech, English). Nearby chatter and shouts are also spoken; **Voice: off** mutes everything. Answers are rule-based (`public/js/dialogue.js`): they know the year, the place, nearby shops, prices, the era and a bit of small talk.
- **1** wave, **2** dance, **Photo** saves a PNG of the view, the **mini map** (top left) shows you (white arrow), police (blue), shopkeepers (yellow) and fights (red).
- Tests: `tests/dialogue.test.js`, `tests/social.test.js` (player fights, talking, shopkeepers returning to their post).

## Install on a phone (PWA)
TimeWarp is an installable web app: manifest, icons (`public/icons`), service worker (`public/sw.js`) and an offline page. The service worker caches only css/js/icons; pages, logins, API calls and chat always come live from the server.
- **An installable app needs https** (or localhost). Over plain `http://192.168.x.x` the phone can open the site and add a shortcut, but cannot install it as an app, and the microphone is blocked.
- Quick test from the laptop with a free https link (no account): download `cloudflared` for Linux, start the server, then run `cloudflared tunnel --url http://localhost:10000`. It prints an `https://....trycloudflare.com` address that changes each time. While it runs, anyone with that link can reach your local site, so stop it (Ctrl+C) when done.
- For a permanent app, deploy to a host with https and PostgreSQL (set `NODE_ENV=production`, `DATABASE_URL`, `SESSION_SECRET`).
- Phone: Chrome (Android) -> open the https address -> use the **Install the TimeWarp app** button at the bottom of the page, or menu -> Install app. iPhone: Safari -> Share -> Add to Home Screen.
- An Android `.apk`/`.aab` can be generated from the deployed https address with PWABuilder (pwabuilder.com). Publishing on Google Play needs a developer account.

## v7: vehicles, mosque, missions (Live World)
- **Cars**: press **E** next to a moving car to stop it and pull the (cartoon) driver out, **E** again to sit in. W/S gas and brake, A/D steer, Shift boost, **E** to get out. Past = tonga, future = hover pod.
- **Bikes** (near your start), **helicopter** (helipad) and **airplane** (runway) at the **airfield in the west**. Space / C (or the on-screen ▲ ▼) go up / down; the plane needs speed to take off. Land before you get out.
- **Bigger map**: 9x9 blocks plus open land. **Mosque ground** in the east: courtyard, hall, dome, minarets, a congregation and an imam praying in rows (qiyam, ruku, sujood). Stand on the free mat and press **E** to join; no fighting there.
- **1000 missions** one after another (`public/js/missions.js`, tested in `tests/missions.test.js`): walk, run against the clock, drive, bike, land the helicopter, fly the plane through a ring, collect coins, pray, talk, shop, buy, wave, dance, photos. Progress is kept in the browser; **Skip mission** is in the panel.
- Nicer look: tone mapping, sky gradient, clouds, ground texture. Stop the server with Ctrl+C.

## v8: Life Mode (`/life`)
Play one whole life, a year at a time: **baby (hospital) -> bachpan -> school -> matric -> college -> career -> shadi and family -> retirement -> old age**. Nothing to install or migrate.
- Choose a name and an era (past / present / future); the text adapts (tonga / car / hover pod, smart hospital, AI teacher).
- Stats: health, knowledge, happiness, relationships, money. Quiet years pass by themselves; a decision pops up at every milestone (first word, school, study habit, matric, FSc field, entry test, first job, marriage, home, Umrah, retirement...) and at random events.
- Choices are gated by what you did before: matric marks decide the FSc field, the degree decides the jobs, savings decide the house and Umrah.
- Good-conduct counters (sachai, sabr and shukr, walidain ki izzat, imandari, padosi ke haqooq) are tracked and shown on the final summary with the "memories" of your life.
- The end age depends on how you treated your health. Final screen: life score, title, virtues, memory list.
- Code: `public/js/life.js` (pure logic, `tests/life.test.js`), `public/js/life-ui.js` (screen), `views/pages/life.ejs`. The whole life is one plain JSON object, ready for the Save mode, and `memories` is ready for the cartoon "Life Movie".
- Not yet: the 3D Live World as the stage, video. These are the next steps in the roadmap document.

## v9: Save System + Life Mode structure (roadmap Phase 1 and 2)
Run `npm run migrate` once (adds the `saves` table). One save slot per player.
- **Continue / New Life** on the home page. Continue opens Life Mode or the Live World, whichever you played last. New Life asks before it throws a saved life away.
- **Signed-in players** are saved in the database: `GET /api/load`, `POST /api/save`, `DELETE /api/save?part=life|world` (all need login; POST/DELETE need the CSRF header like every other write). A save has two parts that are stored separately: `life` (the whole Life Mode JSON) and `world` (era, year, destination, position, money, mission number).
- **Guests** are saved in this browser (`localStorage`, key `timewarp-save-v1`). Nothing is uploaded for guests. A guest save is not moved into an account when the player logs in.
- **Auto-save**: Life Mode after every decision and every year, plus every 20 s; Live World after every mission, every purchase, plus every 20 s; anything still waiting is sent when the page closes. Server saves are limited to one every 4 seconds (the newest data always goes out).
- `?continue=1` resumes at once, `?new=1` (Life) starts clean.
- Safety: the server never trusts a saved life. `TimeWarpLife.restore()` rebuilds it (known fields only, numbers clamped, the open decision rebuilt from the game's own event table) and rejects anything else with a 400. Request size limit is now 64 KB; a life is about 7 KB.
- Life Mode (Phase 2) additions: a "Year of life N" counter, a marker on the age bar, a "saved" indicator. Stats, the age timeline, choices with effects and random events were already part of v8.
- Code: `public/js/save.js` (browser save logic, tested), `services/saveService.js` (server rules, tested), `models/saveModel.js`, `controllers/saveController.js`, `public/js/home-save.js`. Tests: `tests/save.test.js`.

## v10: Life stages + Cartoon Video (roadmap Phase 3 and 4)
No new database table. Mini-games, scenes and video are all browser code.
**Phase 3 – Life stages**
- A cartoon picture for every stage (hospital with family, home and street, classroom, campus, workplace per job, family home, mosque and garden), drawn in code in `public/js/life-art.js`; the era (past / present / future) changes the colours and details.
- 4 mini-games (`public/js/minigames.js`): tap, memory pairs, quiz (maths + general knowledge, 3 levels) and "steady" (stop the marker in the green zone). The score (0 to 1) decides how good the result is; "Chhor do" gives the average result.
- New events: teacher, new friend, class test, annual exam, college life, semester exams, children's school, children's wedding, old-age memories, and a working-day event for each of the 9 jobs (new jobs: Police officer, Shopkeeper). Matric and baby / toddler / nursery choices can also use a game. The salary is shown on screen.
- Fixed: the "Agla saal" button used to stay visible while a decision was open.
**Phase 4 – Video**
- Life Mode: "Meri Life Movie" plays your whole life as a cartoon film (title card, one episode per stage, a scene for every memory, slow camera, widescreen bars, subtitles, generated music, Life Score at the end). "Video banao aur save karo" plays it again while recording a .webm to your device.
- Live World: **Record** records the 3D view (no buttons or map). **Aaj ki video** plays your day's recorded path back as a film: UI hidden, toon shading, outline pass, cinematic camera, "Episode 1: Aaj ka din" title card, subtitles from the street ticker, music, end card; it records itself. Esc cancels. The day log (your position twice a second and the ticker lines) stays in this browser only.
- Needs a browser with MediaRecorder (Chrome, Edge, Firefox). Without it the film still plays, only the save button is off. Limits: the day film follows your path only (other people and cars are live, a vehicle trip is shown as you gliding), and there is no sound from the game in the recording, only the music.
- Code: `public/js/video.js` (plan, camera, edge detection, recorder, music; tested), `life-movie.js`, `world-video.js`. Tests: `tests/minigames.test.js`, `tests/video.test.js`. CSP now allows `blob:` media.

## v11: Phase 5 - the rest of the features (`/me`, day and night, pets, friends ...)
Database: run `database/schema.sql` again (safe to repeat). It adds `saves.meta` (JSONB) and the `life_scores` table.
**Live World**
- Day, night, weather and prayer times (`public/js/daycycle.js`, `world-sky.js`): real sun position for the place, deterministic weather for place + date, light tint, rain, a prayer-time toast with a chime (MWL Fajr 18 deg, Isha 17 deg, Hanafi Asr). Click the sky chip to run a fast day (240x). Limit: the azan is a notification and chime only, no recitation audio.
- GPS line and ETA on the minimap, car colour (`#paint-color`, remembered in the browser).
- Friendship (`public/js/friends.js`): in a conversation choose what to say (salam, praise, joke, ask for help, small gift, heart-to-heart). 5 levels from Ajnabi to Jigri yaar, later options unlock with trust, repeated talk the same day gains little. Stored in this browser.
- Mobile controls: the on-screen pad of the Live World (unchanged, checked at 390 px).
**Life Mode**
- Home (3 levels), things (inventory, vehicles) and pets (max 3, they age and die) with a yearly economy: rent when you have no home, yearly effects of what you own. Jobs: taxi and delivery (need a car/bike, new `drive` and `route` mini-games), pilot needs a licence (quiz + steady hand).
- Dream (chosen at the start, +5 score when done), goals list, diary (your own notes + memories), family tree, Time Capsule (a letter to yourself that opens later and becomes an event).
- Butterfly Effect: pick any past open decision, choose another option, and the same life is replayed with the same random numbers. You see both lives side by side.
- Time Machine: finished lives give points, points buy upgrades (money, knowledge, health ...) for the next lives. Stored as `meta` of your save.
- Life leaderboard: `POST /api/life-score` (login + CSRF) replays the whole life on the server from its saved decisions; a life that does not replay to the same result is refused. `GET /api/life-scores` is public.
**Meri Duniya (`/me`)**: tabs for home and things, family tree, diary, dreams and goals, Time Capsule, Butterfly Effect, Time Machine, leaderboard and settings (language, save file download/open, move this browser's guest save into your account).
**Language**: Urdu, Roman Urdu, English (`public/js/i18n.js`, `data-i18n` attributes). Limit: it covers buttons, labels and the whole `/me` page; the story events inside Life Mode are written in Roman Urdu only.
**Honest limits**: Time Machine points are kept in the browser/account and can be edited by a determined player (they are only clamped to a legal range; the leaderboard does not use them, it verifies the life itself). The sky, GPS and paint code needs Three.js and was checked with a stub, not in a real 3D session. Life Mode shows no real historical persons; if scenes with them are added, they must carry a "Dramatized" badge.
Tests: `tests/phase5.test.js`, `tests/daycycle.test.js`, `tests/phase5b.test.js`.
# timewarp
