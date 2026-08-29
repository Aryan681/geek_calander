const { listEvents } = require('../services/events.service');
const logger = require('../utils/logger');

async function getEvents(req, res, next) {
  try {
    const result = await listEvents(req.query);
    res.set({
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/json; charset=utf-8',
    });
    return res.status(200).json(result);
  } catch (error) {
    logger.error('[EVENTS] Failed to retrieve events:', error.message);
    return next(error);
  }
}

module.exports = { getEvents };
