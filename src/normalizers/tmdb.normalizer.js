const { SOURCES, CATEGORIES } = require('../config/constants');
const { parseReleaseDate } = require('../utils/date');

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w780';

/**
 * Selects the most appropriate release date for a movie, prioritizing Indian theatrical release (iso_3166_1 = 'IN').
 * If Indian release data is not available, falls back to the default/primary release date.
 * 
 * @param {Object} movie
 * @returns {{ releaseDateStr: string, releaseType: string, region: string } | null}
 */
function resolveRegionalReleaseDate(movie) {
  if (!movie || typeof movie !== 'object') return null;

  if (movie.release_dates && Array.isArray(movie.release_dates.results)) {
    const inEntry = movie.release_dates.results.find(
      (r) => r.iso_3166_1 && r.iso_3166_1.toUpperCase() === 'IN'
    );

    if (inEntry && Array.isArray(inEntry.release_dates) && inEntry.release_dates.length > 0) {
      const theatrical = inEntry.release_dates.find((rd) => rd.type === 3) ||
        inEntry.release_dates.find((rd) => rd.type === 2) ||
        inEntry.release_dates.find((rd) => rd.type === 4) ||
        inEntry.release_dates[0];

      if (theatrical && theatrical.release_date) {
        return {
          releaseDateStr: theatrical.release_date,
          releaseType: String(theatrical.type || 'unknown'),
          region: 'IN',
        };
      }
    }
  }

  const fallbackDate = movie.release_date || movie.primary_release_date;
  if (fallbackDate && typeof fallbackDate === 'string') {
    return {
      releaseDateStr: fallbackDate,
      releaseType: 'primary',
      region: 'global',
    };
  }

  return null;
}

/**
 * Normalizes a TMDB movie object into a standard ReleaseEvent.
 * Returns null if the movie has no valid release date or missing essential data.
 * 
 * @param {Object} movie 
 * @returns {Object|null}
 */
function normalizeMovie(movie) {
  if (!movie || typeof movie !== 'object' || !movie.id) return null;

  const resolved = resolveRegionalReleaseDate(movie);
  if (!resolved || !resolved.releaseDateStr) {
    return null;
  }

  const dateInfo = parseReleaseDate(resolved.releaseDateStr);
  if (!dateInfo) {
    return null;
  }

  const externalId = String(movie.id);
  const movieTitle = (movie.title || movie.original_title || 'Untitled').trim();
  const title = `[Movie] ${movieTitle}`;
  const description = movie.overview && typeof movie.overview === 'string' ? movie.overview.trim() : null;
  const url = `https://www.themoviedb.org/movie/${movie.id}`;
  const imageUrl = movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : (movie.backdrop_path ? `${TMDB_IMAGE_BASE}${movie.backdrop_path}` : null);

  return {
    externalId,
    source: SOURCES.TMDB,
    category: CATEGORIES.MOVIE,
    title,
    description,
    releaseDate: dateInfo.date,
    isAllDay: dateInfo.isAllDay,
    url,
    imageUrl,
    rawMetadata: {
      ...movie,
      _resolvedRelease: resolved,
    },
  };
}

module.exports = {
  TMDB_IMAGE_BASE,
  resolveRegionalReleaseDate,
  normalizeMovie,
};
