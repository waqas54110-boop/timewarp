const { wrap } = require('../utils/helpers');
const destinationModel = require('../models/destinationModel');
const eventModel = require('../models/eventModel');

exports.present = wrap(async (req, res) => {
  res.render('pages/present', { title: 'Present Explorer', destinations: await destinationModel.all(), nowYear: new Date().getFullYear() });
});

exports.show = wrap(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const destination = Number.isInteger(id) ? await destinationModel.findById(id) : null;
  if (!destination) return next();
  const { rows } = await eventModel.list({ destinationId: id }, { limit: 50 });
  res.render('pages/destination', { title: destination.name, destination, events: rows });
});

// Old-versus-new comparison: pick a destination and two or three years.
exports.compare = wrap(async (req, res) => {
  const destinations = await destinationModel.all();
  const destId = parseInt(req.query.destinationId, 10);
  const years = ['y1', 'y2', 'y3'].map((k) => parseInt(req.query[k], 10)).filter((y) => Number.isInteger(y) && y >= -5000 && y <= new Date().getFullYear());
  let panels = null;
  let destination = null;
  if (Number.isInteger(destId) && years.length >= 2) {
    destination = await destinationModel.findById(destId);
    if (destination) {
      const all = (await eventModel.list({ destinationId: destId }, { limit: 100 })).rows;
      panels = await Promise.all(years.map(async (year) => {
        const before = all.filter((e) => e.event_year <= year);
        const latest = before[before.length - 1] || null;
        return { year, latest, exact: latest && latest.event_year === year, era: await destinationModel.eraForYear(year) };
      }));
    }
  }
  res.render('pages/compare', { title: 'Compare Then & Now', destinations, destId, years, panels, destination, nowYear: new Date().getFullYear() });
});
