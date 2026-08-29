const eventRepository = require('../repositories/event.repository');
const { generateCalendarICS } = require('./ics.service');
const { getCalendarWindow } = require('../utils/date');
const { CALENDAR_WINDOW } = require('../config/constants');

/**
 * Fetches events within the active calendar window and renders the dynamic ICS feed.
 * 
 * @param {Object} [options]
 * @param {Object} [options.repository] - Optional repository override for testing
 * @param {Date} [options.referenceDate] - Optional reference date
 * @returns {Promise<string>}
 */
async function getDynamicCalendarFeed({
  repository = eventRepository,
  referenceDate = new Date(),
} = {}) {
  const { startDate, endDate } = getCalendarWindow(referenceDate);
  const events = await repository.getEventsInWindow(startDate, endDate);
  return generateCalendarICS(events);
}

module.exports = {
  WINDOW_PAST_DAYS: CALENDAR_WINDOW.PAST_DAYS,
  WINDOW_FUTURE_DAYS: CALENDAR_WINDOW.FUTURE_DAYS,
  getCalendarWindow,
  getDynamicCalendarFeed,
};
