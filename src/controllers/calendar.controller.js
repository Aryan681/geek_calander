const { streamDynamicCalendarFeed } = require('../services/calendar.service');
const logger = require('../utils/logger');

/**
 * Calendar feed controller
 * GET /calendar.ics
 */
async function getCalendarFeed(req, res, next) {
  try {
    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
      'Content-Disposition': 'inline; filename="calendar.ics"',
    });
    res.status(200);

    for await (const chunk of streamDynamicCalendarFeed()) {
      if (!res.write(chunk)) {
        await new Promise((resolve, reject) => {
          const onDrain = () => {
            res.removeListener('error', onError);
            resolve();
          };
          const onError = (error) => {
            res.removeListener('drain', onDrain);
            reject(error);
          };
          res.once('drain', onDrain);
          res.once('error', onError);
        });
      }
    }
    return res.end();
  } catch (error) {
    logger.error('[CALENDAR] Failed to generate calendar.ics feed:', error.message);
    if (res.headersSent) {
      return res.destroy();
    }
    return next(error);
  }
}

module.exports = {
  getCalendarFeed,
};
