const { SOURCES, CATEGORIES } = require('../config/constants');

const VALID_SOURCES = new Set(Object.values(SOURCES));
const VALID_CATEGORIES = new Set(Object.values(CATEGORIES));

/**
 * Validates a normalized ReleaseEvent object before persistence.
 * @param {Object} event 
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateEvent(event) {
  if (!event || typeof event !== 'object') {
    return { valid: false, reason: 'Event is null or not an object' };
  }

  if (!event.externalId || (typeof event.externalId !== 'string' && typeof event.externalId !== 'number')) {
    return { valid: false, reason: 'Missing or invalid externalId' };
  }

  if (!event.source || !VALID_SOURCES.has(event.source)) {
    return { valid: false, reason: `Invalid source: ${event.source}` };
  }

  if (!event.category || !VALID_CATEGORIES.has(event.category)) {
    return { valid: false, reason: `Invalid category: ${event.category}` };
  }

  if (!event.title || typeof event.title !== 'string' || !event.title.trim()) {
    return { valid: false, reason: 'Missing or empty title' };
  }

  if (!(event.releaseDate instanceof Date) || isNaN(event.releaseDate.getTime())) {
    return { valid: false, reason: 'Invalid or missing releaseDate Date object' };
  }

  if (typeof event.isAllDay !== 'boolean') {
    return { valid: false, reason: 'isAllDay must be a boolean' };
  }

  if (event.url !== undefined && event.url !== null && typeof event.url !== 'string') {
    return { valid: false, reason: 'url must be a string if provided' };
  }

  if (event.imageUrl !== undefined && event.imageUrl !== null && typeof event.imageUrl !== 'string') {
    return { valid: false, reason: 'imageUrl must be a string if provided' };
  }

  return { valid: true };
}

/**
 * Deduplicates a list of ReleaseEvents based on (source, category, externalId).
 * Preserves the last instance seen in the list.
 * @param {Array<Object>} events 
 * @returns {Array<Object>}
 */
function deduplicateEvents(events) {
  if (!Array.isArray(events)) return [];

  const dedupMap = new Map();
  for (const event of events) {
    const key = `${event.source}:${event.category}:${event.externalId}`;
    dedupMap.set(key, event);
  }

  return Array.from(dedupMap.values());
}

module.exports = {
  VALID_SOURCES,
  VALID_CATEGORIES,
  validateEvent,
  deduplicateEvents,
};
