const ical = require('ical-generator').default || require('ical-generator');
const { SOURCE_DISPLAY_NAMES } = require('../config/constants');

/**
 * Generates an RFC 5545 compliant iCalendar string from a list of database event records.
 * 
 * @param {Array<Object>} events - Array of records from the events table
 * @returns {string} Raw iCalendar (.ics) string
 */
function generateCalendarICS(events = []) {
  const calendar = ical({
    name: 'Geek Calendar',
    description: 'Upcoming Anime, Movie, and Game Releases',
    prodId: {
      company: 'Geek Calendar',
      product: 'geek-calendar',
      language: 'EN',
    },
    timezone: 'UTC',
  });

  for (const event of events) {
    if (!event || !event.id || !event.title || !event.release_date) {
      continue;
    }

    const releaseDate = new Date(event.release_date);
    if (isNaN(releaseDate.getTime())) {
      continue;
    }

    const isAllDay = Boolean(event.is_all_day);
    const sourceLabel = SOURCE_DISPLAY_NAMES[event.source] || event.source || 'Unknown';

    const descriptionParts = [];
    if (event.description && typeof event.description === 'string' && event.description.trim()) {
      descriptionParts.push(event.description.trim());
    }
    descriptionParts.push(`Source: ${sourceLabel}`);
    const finalDescription = descriptionParts.join('\n\n');

    const eventPayload = {
      id: event.id, // Stable database ID mapped to ICS UID
      summary: event.title,
      description: finalDescription,
      start: releaseDate,
      allDay: isAllDay,
    };

    // RFC 5545 Section 3.6.1: Point-in-time release events with DTSTART and no DTEND/DURATION
    // represent an instantaneous release milestone without implying an artificial viewing/play duration.

    if (event.url && typeof event.url === 'string' && event.url.trim()) {
      eventPayload.url = event.url.trim();
    }

    calendar.createEvent(eventPayload);
  }

  return calendar.toString();
}

module.exports = {
  generateCalendarICS,
};
