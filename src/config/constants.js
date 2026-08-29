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
  PAST_DAYS: 30,
  FUTURE_DAYS: 90,
});

const CACHE = Object.freeze({
  CALENDAR_MAX_AGE_SECONDS: 1800, // 30 minutes
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
  CACHE,
  IGDB_REGIONS,
};
