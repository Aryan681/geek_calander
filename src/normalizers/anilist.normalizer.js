const { SOURCES, CATEGORIES } = require('../config/constants');

/**
 * Strips HTML tags and decodes common HTML entities from AniList descriptions.
 * @param {string|null} html 
 * @returns {string|null}
 */
function cleanDescription(html) {
  if (!html || typeof html !== 'string') return null;
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Extracts preferred display title from AniList title object.
 * @param {Object} titleObj 
 * @returns {string}
 */
function getPreferredTitle(titleObj) {
  if (!titleObj) return 'Untitled';
  return (
    titleObj.userPreferred ||
    titleObj.english ||
    titleObj.romaji ||
    titleObj.native ||
    'Untitled'
  );
}

/**
 * Normalizes an AniList AiringSchedule item into a ReleaseEvent.
 * Returns null if the item lacks essential release information.
 * @param {Object} item 
 * @returns {Object|null}
 */
function normalizeAnimeAiringSchedule(item) {
  if (!item || typeof item !== 'object') return null;

  const airingAt = item.airingAt;
  if (!airingAt || typeof airingAt !== 'number' || isNaN(airingAt) || airingAt <= 0) {
    return null;
  }

  const media = item.media;
  if (!media || typeof media !== 'object' || !media.id) {
    return null;
  }

  const episodeNumber = item.episode || 1;
  const externalId = item.id ? String(item.id) : `anime-${media.id}-ep-${episodeNumber}`;
  const seriesTitle = getPreferredTitle(media.title);
  const title = `[Anime] ${seriesTitle} Episode ${episodeNumber}`;
  const releaseDate = new Date(airingAt * 1000);

  if (isNaN(releaseDate.getTime())) {
    return null;
  }

  const url = media.siteUrl || `https://anilist.co/anime/${media.id}`;
  const imageUrl =
    media.coverImage?.extraLarge ||
    media.coverImage?.large ||
    media.coverImage?.medium ||
    media.bannerImage ||
    null;

  return {
    externalId,
    source: SOURCES.ANILIST,
    category: CATEGORIES.ANIME,
    title,
    description: cleanDescription(media.description),
    releaseDate,
    isAllDay: false,
    url,
    imageUrl,
    rawMetadata: item,
  };
}

/**
 * Manga publication start dates are NOT valid chapter release reminders.
 * Returns null per V1 specifications.
 * @param {Object} media 
 * @returns {null}
 */
function normalizeMangaMedia(media) {
  return null;
}

module.exports = {
  cleanDescription,
  getPreferredTitle,
  normalizeAnimeAiringSchedule,
  normalizeMangaMedia,
};
