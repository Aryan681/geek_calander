const ical = require('ical-generator').default || require('ical-generator');
const { SOURCE_DISPLAY_NAMES } = require('../config/constants');

const CALENDAR_OPTIONS = {
  name: 'Geek Calendar',
  description: 'Upcoming Anime, Movie, and Game Releases',
  prodId: {
    company: 'Geek Calendar',
    product: 'geek-calendar',
    language: 'EN',
  },
  timezone: 'UTC',
};

function createCalendar() {
  return ical(CALENDAR_OPTIONS);
}

function getCalendarHeader() {
  return createCalendar().toString().replace(/END:VCALENDAR$/, '');
}

function getCalendarFooter() {
  return 'END:VCALENDAR';
}

function toEventPayload(event) {
  if (!event || !event.id || !event.title || !event.release_date) return null;

  const releaseDate = new Date(event.release_date);
  if (isNaN(releaseDate.getTime())) return null;

  const sourceLabel = SOURCE_DISPLAY_NAMES[event.source] || event.source || 'Unknown';
  const descriptionParts = [];
  if (event.description && typeof event.description === 'string' && event.description.trim()) {
    descriptionParts.push(event.description.trim());
  }
  descriptionParts.push(`Source: ${sourceLabel}`);

  const payload = {
    id: event.id,
    summary: event.title,
    description: descriptionParts.join('\n\n'),
    start: releaseDate,
    allDay: Boolean(event.is_all_day),
  };
  if (event.url && typeof event.url === 'string' && event.url.trim()) payload.url = event.url.trim();
  return payload;
}

function serializeCalendarEvent(event) {
  const payload = toEventPayload(event);
  if (!payload) return '';
  return createCalendar().createEvent(payload).toString();
}

/**
 * Generates an RFC 5545 compliant iCalendar string from a list of database event records.
 * 
 * @param {Array<Object>} events - Array of records from the events table
 * @returns {string} Raw iCalendar (.ics) string
 */
function generateCalendarICS(events = []) {
  const calendar = createCalendar();

  for (const event of events) {
    const payload = toEventPayload(event);
    if (payload) calendar.createEvent(payload);
  }

  return calendar.toString();
}

module.exports = {
  generateCalendarICS,
  getCalendarHeader,
  getCalendarFooter,
  serializeCalendarEvent,
};
