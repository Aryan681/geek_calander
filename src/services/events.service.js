const eventRepository = require('../repositories/event.repository');
const { CATEGORIES } = require('../config/constants');
const { ValidationError } = require('../utils/errors');

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 500;
const MAX_SEARCH_LENGTH = 200;

function parseDateParameter(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${name} is required`);
  }

  const trimmed = value.trim();
  const date = new Date(trimmed);
  if (!Number.isFinite(date.getTime())) {
    throw new ValidationError(`${name} must be a valid ISO date`);
  }

  // Date-only values must be strict calendar dates; JavaScript otherwise
  // silently normalizes values such as 2026-02-31.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    if (new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString().slice(0, 10) !== trimmed) {
      throw new ValidationError(`${name} must be a valid ISO date`);
    }
  } else if (!/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    throw new ValidationError(`${name} must be an ISO date or ISO datetime`);
  }

  return date;
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

function parseCategory(category) {
  if (category === undefined || category === '') return null;
  if (!Object.values(CATEGORIES).includes(category)) {
    throw new ValidationError('category must be one of: anime, movie, game');
  }
  return category;
}

function parseSearch(search) {
  if (search === undefined) return null;
  if (typeof search !== 'string' || search.length > MAX_SEARCH_LENGTH) {
    throw new ValidationError(`search must be at most ${MAX_SEARCH_LENGTH} characters`);
  }
  const trimmed = search.trim();
  return trimmed || null;
}

function decodeCursor(value, filters) {
  if (!value) return null;
  if (typeof value !== 'string' || value.length > 2048) throw new ValidationError('cursor is invalid');

  let cursor;
  try {
    const json = Buffer.from(value, 'base64url').toString('utf8');
    cursor = JSON.parse(json);
  } catch (error) {
    throw new ValidationError('cursor is invalid');
  }

  if (!cursor || typeof cursor.id !== 'string' || !cursor.id || typeof cursor.releaseDate !== 'string') {
    throw new ValidationError('cursor is invalid');
  }
  const cursorDate = new Date(cursor.releaseDate);
  if (!Number.isFinite(cursorDate.getTime()) || cursor.id.length > 128) {
    throw new ValidationError('cursor is invalid');
  }
  if (cursor.from !== filters.from.toISOString() || cursor.to !== filters.to.toISOString() ||
      cursor.category !== filters.category || cursor.search !== filters.search) {
    throw new ValidationError('cursor does not match the requested filters');
  }
  return { releaseDate: cursorDate, id: cursor.id };
}

function encodeCursor(row, filters) {
  if (!row) return null;
  return Buffer.from(JSON.stringify({
    from: filters.from.toISOString(),
    to: filters.to.toISOString(),
    category: filters.category,
    search: filters.search,
    releaseDate: new Date(row.release_date).toISOString(),
    id: row.id,
  })).toString('base64url');
}

function mapEvent(row) {
  return {
    id: row.id,
    source: row.source,
    category: row.category,
    externalId: row.external_id,
    title: row.title,
    releaseDate: new Date(row.release_date).toISOString(),
    description: row.description ?? null,
    imageUrl: row.image_url ?? null,
    platforms: [],
    externalUrl: row.url ?? null,
  };
}

async function listEvents(query = {}, repository = eventRepository) {
  const from = parseDateParameter(query.from, 'from');
  const to = parseDateParameter(query.to, 'to');
  if (from >= to) throw new ValidationError('from must be earlier than to');

  const filters = {
    from,
    to,
    category: parseCategory(query.category),
    search: parseSearch(query.search),
  };
  const limit = parseLimit(query.limit);
  const cursor = decodeCursor(query.cursor, filters);
  const result = await repository.listEvents({ ...filters, cursor, limit });

  return {
    events: result.rows.map(mapEvent),
    nextCursor: result.hasMore ? encodeCursor(result.rows[result.rows.length - 1], filters) : null,
    total: result.total,
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  listEvents,
  parseDateParameter,
  parseLimit,
  mapEvent,
};
