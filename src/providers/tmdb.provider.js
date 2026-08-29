const axios = require('axios');
const logger = require('../utils/logger');
const { formatYMD } = require('../utils/date');
const { ExternalProviderError } = require('../utils/errors');
const {
  TMDB_IMAGE_BASE,
  resolveRegionalReleaseDate,
  normalizeMovie,
} = require('../normalizers/tmdb.normalizer');
const { CALENDAR_WINDOW, INGESTION } = require('../config/constants');

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
  targetEvents = INGESTION.TARGET_EVENTS_PER_PROVIDER,
  maxPages = INGESTION.MAX_PAGES_PER_PROVIDER,
  client = axios,
} = {}) {
  const now = new Date();
  const past = new Date(now.getTime() - CALENDAR_WINDOW.PAST_DAYS * 24 * 60 * 60 * 1000);
  const future = new Date(now.getTime() + CALENDAR_WINDOW.FUTURE_DAYS * 24 * 60 * 60 * 1000);
  const start = startDate || formatYMD(past);
  const end = endDate || formatYMD(future);
  const moviesById = new Map();

  const countValidMovies = () => {
    let count = 0;
    for (const movie of moviesById.values()) {
      try {
        if (normalizeMovie(movie)) count++;
      } catch (err) {
        // Final normalization below logs malformed records once.
      }
    }
    return count;
  };

  for (let currentPage = page; currentPage < page + maxPages; currentPage++) {
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

    for (const movie of data.results || []) {
      if (movie?.id) moviesById.set(String(movie.id), movie);
    }

    if (countValidMovies() >= targetEvents || currentPage >= (data.total_pages || currentPage) || !(data.results || []).length) {
      break;
    }
  }

  const normalizedEvents = [];
  for (const movie of moviesById.values()) {
    try {
      const event = normalizeMovie(movie);
      if (event) normalizedEvents.push(event);
    } catch (err) {
      logger.warn(`[TMDB] Skipping malformed movie item: ${err.message}`);
    }
  }

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
