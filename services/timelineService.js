const eventModel = require('../models/eventModel');

async function timeline(filters, page, limit = 15) {
  const { rows, total } = await eventModel.list(filters, { limit, offset: (page - 1) * limit });
  return { rows, total };
}

module.exports = { timeline };
