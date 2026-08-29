const eventRepository = require('../repositories/event.repository');
const { generateCalendarICS, getCalendarHeader, getCalendarFooter, serializeCalendarEvent } = require('./ics.service');
const { getCalendarWindow } = require('../utils/date');
const { CALENDAR_WINDOW, CALENDAR_FEED } = require('../config/constants');

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

/**
 * Streams the calendar document as bounded database pages. Only one page and
 * one serialized event are live at a time.
 */
async function* streamDynamicCalendarFeed({
  repository = eventRepository,
  referenceDate = new Date(),
  batchSize = CALENDAR_FEED.BATCH_SIZE,
} = {}) {
  const { startDate, endDate } = getCalendarWindow(referenceDate);
  yield getCalendarHeader();

  let cursor = null;
  do {
    const page = await repository.getEventsInWindowBatch(startDate, endDate, cursor, batchSize);
    for (const event of page.rows) {
      const serialized = serializeCalendarEvent(event);
      if (serialized) yield serialized;
    }
    cursor = page.nextCursor;
  } while (cursor);

  yield getCalendarFooter();
}

module.exports = {
  WINDOW_PAST_MONTHS: CALENDAR_WINDOW.PAST_MONTHS,
  WINDOW_FUTURE_MONTHS: CALENDAR_WINDOW.FUTURE_MONTHS,
  getCalendarWindow,
  getDynamicCalendarFeed,
  streamDynamicCalendarFeed,
};
