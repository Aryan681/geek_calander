const anilistProvider = require('../providers/anilist.provider');
const tmdbProvider = require('../providers/tmdb.provider');
const igdbProvider = require('../providers/igdb.provider');
const eventRepository = require('../repositories/event.repository');
const logger = require('../utils/logger');
const { VALID_SOURCES, VALID_CATEGORIES, validateEvent, deduplicateEvents } = require('../utils/validation');

/**
 * Executes a sync run for a single provider in complete isolation.
 * 
 * @param {string} name - Provider identifier (e.g. 'ANILIST', 'TMDB', 'IGDB')
 * @param {Function} fetchFn - Async function returning ReleaseEvent[]
 * @param {Object} [repoOverride] - Optional repository for testing
 * @returns {Promise<{ name: string, success: boolean, fetched: number, valid: number, invalid: number, upserted: number, error?: string }>}
 */
async function syncProvider(name, fetchFn, repoOverride = eventRepository) {
  const stats = {
    name,
    success: false,
    fetched: 0,
    valid: 0,
    invalid: 0,
    upserted: 0,
  };

  try {
    const rawEvents = await fetchFn();
    stats.fetched = Array.isArray(rawEvents) ? rawEvents.length : 0;

    const validEvents = [];
    for (const event of rawEvents || []) {
      const validation = validateEvent(event);
      if (validation.valid) {
        validEvents.push(event);
      } else {
        stats.invalid++;
        logger.warn(`[${name}] Validation skipped event: ${validation.reason}`);
      }
    }

    const deduplicated = deduplicateEvents(validEvents);
    stats.valid = deduplicated.length;

    if (deduplicated.length > 0) {
      const upsertResult = await repoOverride.upsertEventsBatch(deduplicated);
      stats.upserted = upsertResult.insertedOrUpdated;
    }

    stats.success = true;
    logger.info(`[${name}] fetched=${stats.fetched} valid=${stats.valid} invalid=${stats.invalid} upserted=${stats.upserted}`);
    return stats;
  } catch (error) {
    stats.success = false;
    stats.error = error.message;
    logger.error(`[${name}] Provider sync failed:`, error.message);
    return stats;
  }
}

/**
 * Orchestrates full synchronization across all providers (AniList, TMDB, IGDB).
 * 
 * @param {Object} [options]
 * @param {Object} [options.providers] - Custom provider overrides for testing
 * @param {Object} [options.repository] - Custom repository override for testing
 * @returns {Promise<{ success: boolean, results: Object[], failedProviders: string[] }>}
 */
async function runSync({
  providers = {
    anilist: anilistProvider.fetchUpcomingAnime,
    tmdb: tmdbProvider.fetchUpcomingMovies,
    igdb: igdbProvider.fetchUpcomingGames,
  },
  repository = eventRepository,
} = {}) {
  logger.info('[SYNC] Starting ingestion run...');

  const providerConfigs = [
    { name: 'ANILIST', fn: providers.anilist },
    { name: 'TMDB', fn: providers.tmdb },
    { name: 'IGDB', fn: providers.igdb },
  ];

  const results = [];
  const failedProviders = [];

  for (const p of providerConfigs) {
    const result = await syncProvider(p.name, p.fn, repository);
    results.push(result);
    if (!result.success) {
      failedProviders.push(p.name.toLowerCase());
    }
  }

  const overallSuccess = failedProviders.length === 0;

  if (overallSuccess) {
    logger.info('[SYNC] Ingestion run completed successfully across all providers.');
  } else {
    logger.warn(`[SYNC] Ingestion run finished with partial failures. Failed providers: ${failedProviders.join(', ')}`);
  }

  return {
    success: overallSuccess,
    results,
    failedProviders,
  };
}

module.exports = {
  VALID_SOURCES,
  VALID_CATEGORIES,
  validateEvent,
  deduplicateEvents,
  syncProvider,
  runSync,
};
