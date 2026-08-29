const axios = require('axios');
const { ExternalProviderError } = require('../utils/errors');
const {
  IGDB_IMAGE_BASE_URL,
  formatCoverUrl,
  normalizeIGDBReleaseDates,
} = require('../normalizers/igdb.normalizer');
const { PAGINATION } = require('../config/constants');
const { getCalendarWindow } = require('../utils/date');
const logger = require('../utils/logger');

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const IGDB_API_BASE_URL = 'https://api.igdb.com/v4';

let cachedToken = null;
let tokenExpiresAt = 0;

function resetTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

/**
 * Acquires a Twitch App Access Token using OAuth2 client credentials flow.
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
async function getTwitchAccessToken({ clientId, clientSecret, client = axios } = {}) {
  const cId = clientId || process.env.IGDB_CLIENT_ID;
  const cSecret = clientSecret || process.env.IGDB_CLIENT_SECRET;

  if (!cId || !cSecret) {
    throw new ExternalProviderError('IGDB', 'Credentials (IGDB_CLIENT_ID, IGDB_CLIENT_SECRET) are not configured', 500);
  }

  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  try {
    const response = await client.post(
      TWITCH_TOKEN_URL,
      null,
      {
        params: {
          client_id: cId,
          client_secret: cSecret,
          grant_type: 'client_credentials',
        },
        headers: { Accept: 'application/json' },
        timeout: 10000,
      }
    );

    if (!response.data || !response.data.access_token) {
      throw new ExternalProviderError('Twitch', 'Malformed response from Twitch OAuth token endpoint');
    }

    const token = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;

    cachedToken = token;
    tokenExpiresAt = now + expiresIn * 1000;

    return token;
  } catch (error) {
    resetTokenCache();
    if (error instanceof ExternalProviderError) {
      throw error;
    }
    if (error.response) {
      const status = error.response.status;
      throw new ExternalProviderError('Twitch', `OAuth Error (HTTP ${status}): Failed to obtain access token`, status);
    }
    throw new ExternalProviderError('Twitch', `Network Error: ${error.message}`);
  }
}

/**
 * Executes a POST query against the IGDB API.
 * @param {string} endpoint 
 * @param {string} apicalypseQuery 
 * @param {Object} [options]
 * @returns {Promise<Array<Object>>}
 */
async function queryIGDB(endpoint, apicalypseQuery, { client = axios } = {}) {
  const clientId = process.env.IGDB_CLIENT_ID;
  const token = await getTwitchAccessToken({ client });

  try {
    const url = `${IGDB_API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await client.post(
      url,
      apicalypseQuery,
      {
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain',
          Accept: 'application/json',
        },
        timeout: 10000,
      }
    );

    if (!Array.isArray(response.data)) {
      throw new ExternalProviderError('IGDB', 'Malformed response from IGDB API (expected array of records)');
    }

    return response.data;
  } catch (error) {
    if (error instanceof ExternalProviderError) {
      throw error;
    }
    if (error.response) {
      const status = error.response.status;
      const statusText = error.response.statusText;
      if (status === 401) {
        resetTokenCache();
        throw new ExternalProviderError('IGDB', 'Authentication Error (HTTP 401): Token expired or invalid', 401);
      }
      if (status === 429) {
        throw new ExternalProviderError('IGDB', 'API rate limit exceeded (HTTP 429)', 429);
      }
      throw new ExternalProviderError('IGDB', `HTTP Error ${status} ${statusText}`, status);
    }
    throw new ExternalProviderError('IGDB', `Network Error: ${error.message}`);
  }
}

/**
 * Fetches and normalizes upcoming video game releases from IGDB.
 * @param {Object} [options]
 * @returns {Promise<Array<Object>>}
 */
async function fetchUpcomingGames({
  startDateSec,
  endDateSec,
  limit = 100,
  calendarWindow,
  maxPages = Number.parseInt(process.env.PAGINATION_GUARD_MAX_PAGES, 10) || PAGINATION.EMERGENCY_MAX_PAGES,
  client = axios,
} = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const defaultWindow = calendarWindow || getCalendarWindow();
  const start = startDateSec !== undefined ? startDateSec : Math.floor(defaultWindow.startDate.getTime() / 1000);
  const end = endDateSec !== undefined ? endDateSec : Math.floor(defaultWindow.endDate.getTime() / 1000);
  const records = [];
  let pages = 0;

  for (let page = 0; ; page++) {
    if (page >= maxPages) {
      logger.error(`[IGDB] Pagination safety guard triggered after ${maxPages} pages`);
      throw new ExternalProviderError('IGDB', `Pagination safety guard triggered after ${maxPages} pages`);
    }
    const offset = page * limit;
    const query = [
      'fields id, date, human, platform.name, platform.abbreviation, region, game.id, game.name, game.summary, game.url, game.slug, game.cover.image_id, game.cover.url;',
      `where date >= ${start} & date <= ${end} & game != null & game.name != null;`,
      'sort date asc;',
      `limit ${limit};`,
      `offset ${offset};`,
    ].join(' ');

    const pageRecords = await queryIGDB('/release_dates', query, { client });
    pages++;
    logger.info(`[IGDB] offset=${offset} fetched=${pageRecords.length}`);
    records.push(...pageRecords);

    if (pageRecords.length < limit) {
      break;
    }
  }

  const events = normalizeIGDBReleaseDates(records);
  Object.defineProperty(events, 'pages', { value: pages, enumerable: false });
  return events;
}

module.exports = {
  TWITCH_TOKEN_URL,
  IGDB_API_BASE_URL,
  IGDB_IMAGE_BASE_URL,
  resetTokenCache,
  getTwitchAccessToken,
  formatCoverUrl,
  normalizeIGDBReleaseDates,
  queryIGDB,
  fetchUpcomingGames,
};
