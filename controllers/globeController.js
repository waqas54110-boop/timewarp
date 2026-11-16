const { wrap } = require('../utils/helpers');
const eventModel = require('../models/eventModel');

exports.page = (req, res) => res.render('pages/globe', { title: 'Time Globe', nowYear: new Date().getFullYear() });
exports.apiGlobe = wrap(async (req, res) => res.json({ data: await eventModel.geo() }));
