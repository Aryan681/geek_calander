const axios = require('axios');
const logger = require('../utils/logger');
const { ExternalProviderError } = require('../utils/errors');
const { PAGINATION } = require('../config/constants');
const { getCalendarWindow, formatYMD } = require('../utils/date');
const { normalizeMangaChapter } = require('../normalizers/mangadex.normalizer');

const MANGADEX_API_BASE_URL = 'https://api.mangadex.org';

async function fetchMangaDexPage(params, client = axios) {
  try {
    const response = await client.get(`${process.env.MANGADEX_API_BASE_URL || MANGADEX_API_BASE_URL}/chapter`, {
      params, headers: { Accept: 'application/json' }, timeout: 15000,
    });
    if (!response.data || response.data.result !== 'ok' || !Array.isArray(response.data.data)) {
      throw new ExternalProviderError('MangaDex', 'Malformed chapter response');
    }
    return response.data;
  } catch (error) {
    if (error instanceof ExternalProviderError) throw error;
    const status = error.response?.status;
    if (status === 429) throw new ExternalProviderError('MangaDex', 'API rate limit exceeded (HTTP 429)', 429);
    if (status) throw new ExternalProviderError('MangaDex', `HTTP Error ${status}`, status);
    throw new ExternalProviderError('MangaDex', `Network Error: ${error.message}`);
  }
}

async function fetchUpcomingManga({
  calendarWindow = getCalendarWindow(), perPage = 100,
  maxPages = Number.parseInt(process.env.PAGINATION_GUARD_MAX_PAGES, 10) || PAGINATION.EMERGENCY_MAX_PAGES,
  rateLimitRetries = 3, rateLimitBackoffMs = 5000,
  client = axios,
} = {}) {
  const start = calendarWindow.startDate.toISOString();
  const end = calendarWindow.endDate.toISOString();
  const byId = new Map(); let fetched = 0;
  let offset = 0; let pages = 0; let total = null;
  for (;;) {
    if (pages >= maxPages) throw new ExternalProviderError('MangaDex', `Pagination safety guard triggered after ${maxPages} pages`);
    let page;
    for (let attempt = 0; ; attempt++) {
      try {
        page = await fetchMangaDexPage({
          limit: perPage, offset, publishAtSince: start, publishAtUntil: end,
          'order[publishAt]': 'asc', 'translatedLanguage[]': 'en', 'includes[]': 'manga',
        }, client);
        break;
      } catch (error) {
        const retryable = error.statusCode === 429 || error.statusCode >= 500;
        if (!retryable || attempt >= rateLimitRetries) throw error;
        const delay = rateLimitBackoffMs * (attempt + 1);
        logger.warn(`[MANGADEX] transient failure; retry=${attempt + 1}/${rateLimitRetries} backoff_ms=${delay}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    pages++;
    fetched += page.data.length;
    const included = new Map((page.included || []).filter((item) => item?.type === 'manga' && item.id).map((item) => [item.id, item]));
    for (const chapter of page.data) {
      if (chapter?.id) byId.set(chapter.id, { chapter, manga: (chapter.relationships || []).find((r) => r.type === 'manga')?.id ? included.get((chapter.relationships || []).find((r) => r.type === 'manga').id) : null });
    }
    total = Number.isInteger(page.total) ? page.total : total;
    logger.info(`[MANGADEX] offset=${offset} fetched=${page.data.length}`);
    if (page.data.length < perPage || (total !== null && offset + page.data.length >= total)) break;
    offset += perPage;
  }
  const events = []; let invalid = 0;
  for (const { chapter, manga } of byId.values()) {
    try {
      const event = normalizeMangaChapter(chapter, manga);
      if (event && event.releaseDate >= calendarWindow.startDate && event.releaseDate <= calendarWindow.endDate) events.push(event);
      else invalid++;
    } catch (error) { logger.warn(`[MANGADEX] Skipping malformed manga item: ${error.message}`); }
  }
  Object.defineProperty(events, 'pages', { value: pages, enumerable: false });
  Object.defineProperty(events, 'fetched', { value: fetched, enumerable: false });
  Object.defineProperty(events, 'invalid', { value: invalid, enumerable: false });
  return events;
}

module.exports = { MANGADEX_API_BASE_URL, fetchMangaDexPage, fetchUpcomingManga, normalizeMangaChapter };
