const axios = require('axios');
const logger = require('../utils/logger');
const { ExternalProviderError } = require('../utils/errors');
const {
  cleanDescription,
  getPreferredTitle,
  normalizeAnimeAiringSchedule,
  normalizeMangaMedia,
} = require('../normalizers/anilist.normalizer');
const { PAGINATION } = require('../config/constants');
const { getCalendarWindow } = require('../utils/date');

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

const AIRING_ANIME_QUERY = `
  query ($page: Int, $perPage: Int, $airingAtGreater: Int, $airingAtLesser: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        hasNextPage
        currentPage
      }
      airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME) {
        id
        airingAt
        episode
        mediaId
        media {
          id
          title {
            romaji
            english
            native
            userPreferred
          }
          description
          siteUrl
          coverImage {
            extraLarge
            large
            medium
          }
          bannerImage
          status
          format
          episodes
          genres
          synonyms
        }
      }
    }
  }
`;

/**
 * Executes a GraphQL query against AniList.
 * @param {string} query 
 * @param {Object} variables 
 * @param {Object} [client]
 * @returns {Promise<Object>}
 */
async function fetchAniListGraphQL(query, variables = {}, client = axios) {
  try {
    const response = await client.post(
      ANILIST_GRAPHQL_ENDPOINT,
      { query, variables },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.data && response.data.errors && response.data.errors.length > 0) {
      const errorMessages = response.data.errors.map((e) => e.message).join('; ');
      throw new ExternalProviderError('AniList', `GraphQL Error: ${errorMessages}`);
    }

    if (!response.data || !response.data.data) {
      throw new ExternalProviderError('AniList', 'Malformed response from GraphQL API');
    }

    return response.data.data;
  } catch (error) {
    if (error instanceof ExternalProviderError) {
      throw error;
    }
    if (error.response) {
      const status = error.response.status;
      const statusText = error.response.statusText;
      if (status === 429) {
        throw new ExternalProviderError('AniList', 'API rate limit exceeded (HTTP 429)', 429);
      }
      throw new ExternalProviderError('AniList', `HTTP Error ${status} ${statusText}`, status);
    }
    throw new ExternalProviderError('AniList', `Network Error: ${error.message}`);
  }
}

/**
 * Fetches and normalizes upcoming Anime airing schedules within a time range.
 * @param {Object} [options]
 * @returns {Promise<Array<Object>>}
 */
async function fetchUpcomingAnime({
  airingAtGreater,
  airingAtLesser,
  perPage = 50,
  calendarWindow,
  maxPages = Number.parseInt(process.env.PAGINATION_GUARD_MAX_PAGES, 10) || PAGINATION.EMERGENCY_MAX_PAGES,
  requestDelayMs = Number.parseInt(process.env.ANILIST_REQUEST_DELAY_MS, 10) || PAGINATION.ANILIST_REQUEST_DELAY_MS,
  rateLimitRetries = Number.parseInt(process.env.ANILIST_RATE_LIMIT_RETRIES, 10) || PAGINATION.ANILIST_RATE_LIMIT_RETRIES,
  rateLimitBackoffMs = Number.parseInt(process.env.ANILIST_RATE_LIMIT_BACKOFF_MS, 10) || PAGINATION.ANILIST_RATE_LIMIT_BACKOFF_MS,
  client = axios,
} = {}) {
  const defaultWindow = calendarWindow || getCalendarWindow();
  const defaultStart = Math.floor(defaultWindow.startDate.getTime() / 1000);
  const defaultEnd = Math.floor(defaultWindow.endDate.getTime() / 1000);
  const startSec = airingAtGreater ?? defaultStart;
  const endSec = airingAtLesser ?? defaultEnd;
  const schedulesById = new Map();
  let pages = 0;

  for (let page = 1; ; page++) {
    if (page > maxPages) {
      logger.error(`[AniList] Pagination safety guard triggered after ${maxPages} pages`);
      throw new ExternalProviderError('AniList', `Pagination safety guard triggered after ${maxPages} pages`);
    }
    let data;
    for (let attempt = 0; ; attempt++) {
      try {
        data = await fetchAniListGraphQL(
          AIRING_ANIME_QUERY,
          {
            page,
            perPage,
            airingAtGreater: startSec,
            airingAtLesser: endSec,
          },
          client
        );
        break;
      } catch (error) {
        if (error.statusCode !== 429 || attempt >= rateLimitRetries) throw error;
        const delay = rateLimitBackoffMs * (attempt + 1);
        logger.warn(`[ANILIST] rate limit page=${page}; retry=${attempt + 1}/${rateLimitRetries} backoff_ms=${delay}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    pages++;

    const pageData = data?.Page;
    const schedules = pageData?.airingSchedules || [];
    logger.info(`[ANILIST] page=${page} fetched=${schedules.length}`);
    for (const item of schedules) {
      const key = item?.id ? String(item.id) : `${item?.media?.id}:${item?.episode}:${item?.airingAt}`;
      if (key !== 'undefined:undefined:undefined') schedulesById.set(key, item);
    }

    const pageInfo = pageData?.pageInfo;
    if (!pageInfo || pageInfo.currentPage !== page) {
      throw new ExternalProviderError('AniList', `Malformed pagination metadata on page ${page}`);
    }
    if (!pageInfo.hasNextPage || schedules.length === 0) {
      break;
    }
    if (requestDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, requestDelayMs));
    }
  }

  const results = [];
  for (const item of schedulesById.values()) {
    try {
      const normalized = normalizeAnimeAiringSchedule(item);
      if (normalized) results.push(normalized);
    } catch (err) {
      logger.warn(`[AniList] Skipping malformed anime item: ${err.message}`);
    }
  }

  Object.defineProperty(results, 'pages', { value: pages, enumerable: false });
  return results;
}

/**
 * Manga provider hook for AniList (returns empty list in V1).
 * @returns {Promise<Array<Object>>}
 */
async function fetchUpcomingManga() {
  return [];
}

module.exports = {
  ANILIST_GRAPHQL_ENDPOINT,
  AIRING_ANIME_QUERY,
  cleanDescription,
  getPreferredTitle,
  normalizeAnimeAiringSchedule,
  normalizeMangaMedia,
  fetchAniListGraphQL,
  fetchUpcomingAnime,
  fetchUpcomingManga,
};
