const destinationModel = require('../models/destinationModel');
const eventModel = require('../models/eventModel');
const predictionModel = require('../models/predictionModel');
const sceneModel = require('../models/sceneModel');
const { formatYear } = require('../utils/helpers');
const { YEAR_MIN, YEAR_MAX } = require('../middleware/validation');

const MODES = ['past', 'present', 'future'];

// Pure validation: returns { ok, errors, value }.
function validateSelection({ mode, year, destinationId }, now = new Date().getFullYear()) {
  const errors = [];
  if (!MODES.includes(mode)) errors.push('Choose Past, Present or Future.');
  let y = mode === 'present' ? now : Number(year);
  if (!Number.isInteger(y)) errors.push('Enter a valid year.');
  else if (mode === 'past' && (y < YEAR_MIN || y >= now)) errors.push(`Past years must be between ${YEAR_MIN} and ${now - 1}.`);
  else if (mode === 'future' && (y <= now || y > YEAR_MAX)) errors.push(`Future years must be between ${now + 1} and ${YEAR_MAX}.`);
  let dId = null;
  if (destinationId !== undefined && destinationId !== '' && destinationId !== null) {
    dId = Number(destinationId);
    if (!Number.isInteger(dId) || dId < 1) errors.push('Invalid destination.');
  }
  return { ok: errors.length === 0, errors, value: { mode, year: y, destinationId: dId } };
}

async function buildJourney({ mode, year, destinationId }) {
  const destination = destinationId ? await destinationModel.findById(destinationId) : null;
  if (destinationId && !destination) return { error: 'That destination does not exist.' };

  const era = mode === 'future' ? null : await destinationModel.eraForYear(year);
  const result = { mode, year, destination, era, events: [], worldEvents: [], predictions: [], approximate: false, scene: null };

  if (mode === 'future') {
    result.predictions = await predictionModel.nearestToYear(year, 6);
    result.scene = await pickScene(result);
    return result;
  }

  if (destination) {
    const own = await eventModel.list({ destinationId: destination.id }, { limit: 100 });
    // nearest events to the chosen year, flagged as approximate when none is within 50 years
    result.events = own.rows
      .map((e) => ({ ...e, distance: Math.abs(e.event_year - year) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .sort((a, b) => a.event_year - b.event_year);
    result.approximate = result.events.length === 0 || result.events[0].distance > 50;
  }
  const around = await eventModel.list({ from: year - 25, to: year + 25 }, { limit: 6 });
  result.worldEvents = around.rows.filter((e) => !destination || e.destination_id !== destination.id);
  result.scene = await pickScene(result);
  return result;
}

// Only same-site paths and http(s) URLs may be used as scene media.
const safeUrl = (u) => (typeof u === 'string' && /^(https?:\/\/|\/(?!\/))/.test(u) ? u : null);

// Scene for the full-screen view: curated scene -> nearest event/destination image -> null (generated scene).
async function pickScene(r) {
  const row = await sceneModel.pick({ mode: r.mode, year: r.year, destinationId: r.destination ? r.destination.id : null });
  if (row && safeUrl(row.media_url)) {
    return { type: row.media_type, url: safeUrl(row.media_url), poster: safeUrl(row.poster_url), caption: row.title || null, credit: row.credit || null };
  }
  if (r.mode !== 'future') {
    const ev = [...r.events, ...r.worldEvents].find((e) => safeUrl(e.image_url));
    if (ev) return { type: 'image', url: safeUrl(ev.image_url), poster: null, caption: `${ev.title} (${formatYear(ev.event_year)})`, credit: null };
    if (r.destination && safeUrl(r.destination.image_url)) {
      return { type: 'image', url: safeUrl(r.destination.image_url), poster: null, caption: r.destination.name, credit: null };
    }
  }
  return null;
}

module.exports = { validateSelection, buildJourney, safeUrl, MODES };
