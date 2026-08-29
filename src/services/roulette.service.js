const { ValidationError, NotFoundError } = require('../utils/errors');
const { mapEvent } = require('./events.service');

const CATEGORIES = new Set(['all', 'anime', 'movie', 'game']);
const WINDOWS = new Set(['recent', 'week', 'month']);
const MODES = new Set(['random', 'fresh']);
const MAX_EXCLUDE = 50;

function parseChoice(value, allowed, name, fallback) {
  const choice = value === undefined || value === '' ? fallback : value;
  if (typeof choice !== 'string' || !allowed.has(choice)) {
    throw new ValidationError(`${name} must be one of: ${[...allowed].join(', ')}`);
  }
  return choice;
}

function parseExclude(value) {
  if (value === undefined || value === '') return [];
  if (typeof value !== 'string') throw new ValidationError('exclude is invalid');
  const ids = value.split(',');
  if (ids.length > MAX_EXCLUDE || ids.some((id) => !/^[A-Za-z0-9:_-]{1,128}$/.test(id))) {
    throw new ValidationError(`exclude must contain at most ${MAX_EXCLUDE} valid IDs`);
  }
  return [...new Set(ids)];
}

function getWindow(windowName, referenceDate = new Date()) {
  const now = new Date(referenceDate);
  if (!Number.isFinite(now.getTime())) throw new ValidationError('reference date is invalid');
  if (windowName === 'recent') {
    return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (windowName === 'week') {
    return { from: start, to: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000) };
  }
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

async function getRoulette(query = {}, repository = null, referenceDate = new Date()) {
  const category = parseChoice(query.category, CATEGORIES, 'category', 'all');
  const window = parseChoice(query.window, WINDOWS, 'window', 'month');
  const mode = parseChoice(query.mode, MODES, 'mode', 'random');
  const exclude = parseExclude(query.exclude);
  const activeRepository = repository || require('../repositories/event.repository');
  const result = await activeRepository.rouletteEvent({
    ...getWindow(window, referenceDate),
    category: category === 'all' ? null : category,
    mode,
    exclude,
  });
  if (!result) throw new NotFoundError('No releases match these Roulette settings');
  return { event: mapEvent(result) };
}

module.exports = { MAX_EXCLUDE, getRoulette, getWindow, parseExclude };
