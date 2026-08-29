const { getDynamicCalendarFeed } = require('../services/calendar.service');
const logger = require('../utils/logger');

/**
 * Calendar feed controller
 * GET /calendar.ics
 */
async function getCalendarFeed(req, res, next) {
  try {
    const icsContent = await getDynamicCalendarFeed();

    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
      'Content-Disposition': 'inline; filename="calendar.ics"',
    });

    return res.status(200).send(icsContent);
  } catch (error) {
    logger.error('[CALENDAR] Failed to generate calendar.ics feed:', error.message);
    return next(error);
  }
}

module.exports = {
  getCalendarFeed,
};
