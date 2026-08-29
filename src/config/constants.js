const SOURCES = Object.freeze({
  ANILIST: 'anilist',
  TMDB: 'tmdb',
  IGDB: 'igdb',
});

const CATEGORIES = Object.freeze({
  ANIME: 'anime',
  MANGA: 'manga',
  MOVIE: 'movie',
  GAME: 'game',
});

const SOURCE_DISPLAY_NAMES = Object.freeze({
  [SOURCES.ANILIST]: 'AniList',
  [SOURCES.TMDB]: 'TMDB',
  [SOURCES.IGDB]: 'IGDB',
});

const CALENDAR_WINDOW = Object.freeze({
  PAST_MONTHS: 6,
  FUTURE_MONTHS: 6,
});

const PAGINATION = Object.freeze({
  // Emergency-only guard. Providers must normally stop using their own metadata.
  EMERGENCY_MAX_PAGES: 10000,
  ANILIST_REQUEST_DELAY_MS: 750,
  ANILIST_RATE_LIMIT_RETRIES: 3,
  ANILIST_RATE_LIMIT_BACKOFF_MS: 5000,
  TMDB_PAGE_CONCURRENCY: 4,
  TMDB_BATCH_DELAY_MS: 1000,
});

const CACHE = Object.freeze({
  CALENDAR_MAX_AGE_SECONDS: 1800, // 30 minutes
});

const CALENDAR_FEED = Object.freeze({
  BATCH_SIZE: 500,
  QUERY_TIMEOUT_MS: 15000,
});

const IGDB_REGIONS = Object.freeze({
  1: 'Europe',
  2: 'North America',
  3: 'Australia',
  4: 'New Zealand',
  5: 'Japan',
  6: 'China',
  7: 'Asia',
  8: 'Worldwide',
  9: 'Korea',
  10: 'Brazil',
});

module.exports = {
  SOURCES,
  CATEGORIES,
  SOURCE_DISPLAY_NAMES,
  CALENDAR_WINDOW,
  PAGINATION,
  CALENDAR_FEED,
  CACHE,
  IGDB_REGIONS,
};
