const axios = require('axios');
const logger = require('../utils/logger');
const { ExternalProviderError } = require('../utils/errors');
const {
  TMDB_IMAGE_BASE,
  resolveRegionalReleaseDate,
  normalizeMovie,
} = require('../normalizers/tmdb.normalizer');
const { PAGINATION } = require('../config/constants');
const { getCalendarWindow, getCalendarMonthWindows, formatYMD } = require('../utils/date');

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Executes an HTTP GET request to TMDB with authentication.
 * @param {string} endpoint 
 * @param {Object} [params] 
 * @param {Object} [client]
 * @returns {Promise<Object>}
 */
async function fetchFromTMDB(endpoint, params = {}, client = axios) {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    throw new ExternalProviderError('TMDB', 'TMDB_API_KEY is not configured in the environment', 500);
  }

  const isBearer = apiKey.length > 40;
  const headers = { Accept: 'application/json' };
  const queryParams = { ...params };

  if (isBearer) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    queryParams.api_key = apiKey;
  }

  try {
    const url = `${TMDB_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await client.get(url, {
      params: queryParams,
      headers,
      timeout: 10000,
    });

    if (!response.data || typeof response.data !== 'object') {
      throw new ExternalProviderError('TMDB', 'Malformed response from TMDB API');
    }

    return response.data;
  } catch (error) {
    if (error instanceof ExternalProviderError) {
      throw error;
    }
    if (error.response) {
      const status = error.response.status;
      const statusText = error.response.statusText;
      if (status === 429) {
        throw new ExternalProviderError('TMDB', 'API rate limit exceeded (HTTP 429)', 429);
      }
      if (status === 401 || status === 403) {
        throw new ExternalProviderError('TMDB', 'API authentication failed (HTTP 401/403)', status);
      }
      throw new ExternalProviderError('TMDB', `HTTP Error ${status} ${statusText}`, status);
    }
    throw new ExternalProviderError('TMDB', `Network Error: ${error.message}`);
  }
}

/**
 * Fetches upcoming movie releases relevant to India within a specified date window.
 * @param {Object} [options]
 * @returns {Promise<Array<Object>>}
 */
async function fetchUpcomingMovies({
  startDate,
  endDate,
  page = 1,
  region = 'IN',
  calendarWindow,
  maxPages = Number.parseInt(process.env.PAGINATION_GUARD_MAX_PAGES, 10) || PAGINATION.EMERGENCY_MAX_PAGES,
  pageConcurrency = PAGINATION.TMDB_PAGE_CONCURRENCY,
  batchDelayMs = PAGINATION.TMDB_BATCH_DELAY_MS,
  client = axios,
} = {}) {
  const safeConcurrency = Math.max(1, Number.parseInt(pageConcurrency, 10) || 1);
  const now = new Date();
  const defaultWindow = calendarWindow || getCalendarWindow(now);
  const requestedStart = startDate ? new Date(`${startDate}T00:00:00.000Z`) : defaultWindow.startDate;
  const requestedEnd = endDate ? new Date(`${endDate}T23:59:59.999Z`) : defaultWindow.endDate;
  const monthWindows = getCalendarMonthWindows(requestedStart, requestedEnd);
  const moviesById = new Map();
  let pages = 0;

  for (const monthWindow of monthWindows) {
    const start = formatYMD(monthWindow.startDate);
    const end = formatYMD(monthWindow.endDate);
    if (pages >= maxPages) {
      logger.error(`[TMDB] Pagination safety guard triggered after ${maxPages} pages`);
      throw new ExternalProviderError('TMDB', `Pagination safety guard triggered after ${maxPages} pages`);
    }
    const fetchPage = async (currentPage) => {
      const data = await fetchFromTMDB(
        '/discover/movie',
        {
          page: currentPage,
          region,
          'primary_release_date.gte': start,
          'primary_release_date.lte': end,
          sort_by: 'primary_release_date.asc',
          include_adult: false,
          include_video: false,
        },
        client
      );
      logger.info(`[TMDB] page=${currentPage} fetched=${(data.results || []).length} range=${start}..${end}`);
      pages++;
      for (const movie of data.results || []) {
        if (movie?.id) moviesById.set(String(movie.id), movie);
      }
      return data;
    };

    const firstPage = await fetchPage(page);
    if (!Number.isInteger(firstPage.total_pages)) {
      throw new ExternalProviderError('TMDB', `Malformed pagination metadata on page ${page}`);
    }
    if (firstPage.total_pages > 500) {
      throw new ExternalProviderError('TMDB', `Monthly partition exceeds TMDB page ceiling: ${firstPage.total_pages}`);
    }

    for (let batchStart = page + 1; batchStart <= firstPage.total_pages; batchStart += safeConcurrency) {
      const batchEnd = Math.min(batchStart + safeConcurrency - 1, firstPage.total_pages);
      if (pages + (batchEnd - batchStart + 1) > maxPages) {
        logger.error(`[TMDB] Pagination safety guard triggered after ${maxPages} pages`);
        throw new ExternalProviderError('TMDB', `Pagination safety guard triggered after ${maxPages} pages`);
      }
      await Promise.all(Array.from({ length: batchEnd - batchStart + 1 }, (_, index) => fetchPage(batchStart + index)));
      if (batchEnd < firstPage.total_pages && batchDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      }
    }
  }

  const normalizedEvents = [];
  const filterStart = calendarWindow?.startDate || requestedStart;
  const filterEnd = calendarWindow?.endDate || requestedEnd;
  for (const movie of moviesById.values()) {
    try {
      const event = normalizeMovie(movie);
      if (event && event.releaseDate >= filterStart && event.releaseDate <= filterEnd) normalizedEvents.push(event);
    } catch (err) {
      logger.warn(`[TMDB] Skipping malformed movie item: ${err.message}`);
    }
  }

  Object.defineProperty(normalizedEvents, 'pages', { value: pages, enumerable: false });
  return normalizedEvents;
}

module.exports = {
  TMDB_BASE_URL,
  TMDB_IMAGE_BASE,
  resolveRegionalReleaseDate,
  normalizeMovie,
  fetchFromTMDB,
  fetchUpcomingMovies,
};
