const axios = require('axios');
const logger = require('../utils/logger');
const { ExternalProviderError } = require('../utils/errors');
const {
  cleanDescription,
  getPreferredTitle,
  normalizeAnimeAiringSchedule,
  normalizeMangaMedia,
} = require('../normalizers/anilist.normalizer');

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
async function fetchUpcomingAnime({ airingAtGreater, airingAtLesser, perPage = 50, client = axios } = {}) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const startSec = airingAtGreater ?? nowInSeconds;
  const endSec = airingAtLesser ?? (nowInSeconds + 14 * 24 * 60 * 60);

  const data = await fetchAniListGraphQL(
    AIRING_ANIME_QUERY,
    {
      page: 1,
      perPage,
      airingAtGreater: startSec,
      airingAtLesser: endSec,
    },
    client
  );

  const schedules = data?.Page?.airingSchedules || [];
  const results = [];

  for (const item of schedules) {
    try {
      const normalized = normalizeAnimeAiringSchedule(item);
      if (normalized) {
        results.push(normalized);
      }
    } catch (err) {
      logger.warn(`[AniList] Skipping malformed anime item: ${err.message}`);
    }
  }

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
