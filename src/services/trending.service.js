const { ValidationError } = require('../utils/errors');
const { mapEvent } = require('./events.service');

const CATEGORIES = new Set(['all', 'anime', 'manga', 'comic', 'movie', 'game']);
const WINDOWS = new Set(['day', 'week', 'month']);
const MODES = new Set(['fresh', 'upcoming']);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseChoice(value, allowed, name, fallback) {
  const choice = value === undefined || value === '' ? fallback : value;
  if (typeof choice !== 'string' || !allowed.has(choice)) {
    throw new ValidationError(`${name} must be one of: ${[...allowed].join(', ')}`);
  }
  return choice;
}

function parseLimit(value) {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!/^\d+$/.test(String(value))) throw new ValidationError('limit must be a positive integer');
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new ValidationError(`limit must be between 1 and ${MAX_LIMIT}`);
  }
  return limit;
}

/**
 * "Fresh" is deliberately not called popular: the database has no reliable
 * popularity signal. It ranks by release_date, newest first. "Upcoming"
 * ranks the same real dates nearest first.
 */
function getTrendingWindow(windowName, mode, referenceDate = new Date()) {
  const now = new Date(referenceDate);
  if (!Number.isFinite(now.getTime())) throw new ValidationError('reference date is invalid');
  const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const days = windowName === 'day' ? 1 : windowName === 'week' ? 7 : 30;
  if (mode === 'upcoming') {
    return { from: endOfToday, to: new Date(endOfToday.getTime() + days * 24 * 60 * 60 * 1000) };
  }
  return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), to: now };
}

async function listTrending(query = {}, repository = null, referenceDate = new Date()) {
  const category = parseChoice(query.category, CATEGORIES, 'category', 'all');
  const window = parseChoice(query.window, WINDOWS, 'window', 'week');
  const mode = parseChoice(query.mode, MODES, 'mode', 'fresh');
  const limit = parseLimit(query.limit);
  const activeRepository = repository || require('../repositories/event.repository');
  const rows = await activeRepository.listTrending({
    ...getTrendingWindow(window, mode, referenceDate),
    category: category === 'all' ? null : category,
    mode,
    limit,
  });
  return {
    events: rows.map(mapEvent),
    window,
    category,
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  getTrendingWindow,
  listTrending,
  parseLimit,
};
