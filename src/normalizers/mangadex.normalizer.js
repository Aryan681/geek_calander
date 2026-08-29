const { SOURCES, CATEGORIES } = require('../config/constants');
const { parseReleaseDate } = require('../utils/date');

function normalizeMangaChapter(chapter, manga = null) {
  if (!chapter || typeof chapter !== 'object' || typeof chapter.id !== 'string' || !chapter.id.trim()) return null;
  const attributes = chapter.attributes;
  if (!attributes || typeof attributes !== 'object') return null;
  const dateInfo = parseReleaseDate(attributes.publishAt);
  if (!dateInfo) return null;
  if (chapter.id.length > 128) return null;
  const mangaAttributes = manga?.attributes || {};
  const mangaTitle = mangaAttributes.title?.en || Object.values(mangaAttributes.title || {})[0];
  if (typeof mangaTitle !== 'string' || !mangaTitle.trim()) return null;
  const chapterLabel = attributes.chapter ? ` Chapter ${attributes.chapter}` : '';
  const volumeLabel = attributes.volume ? ` (Vol. ${attributes.volume})` : '';
  const language = attributes.translatedLanguage || null;
  return {
    externalId: chapter.id,
    source: SOURCES.MANGADEX,
    category: CATEGORIES.MANGA,
    title: `[Manga] ${mangaTitle.trim()}${chapterLabel}${volumeLabel}`,
    description: attributes.title ? String(attributes.title).trim() : null,
    releaseDate: dateInfo.date,
    isAllDay: dateInfo.isAllDay,
    url: `https://mangadex.org/chapter/${chapter.id}`,
    imageUrl: mangaAttributes.coverArtFileName && manga.id
      ? `https://uploads.mangadex.org/covers/${manga.id}/${mangaAttributes.coverArtFileName}`
      : null,
    rawMetadata: { chapter, manga, publication: { field: 'publishAt', language } },
  };
}

module.exports = { normalizeMangaChapter };
