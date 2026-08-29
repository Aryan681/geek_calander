const { SOURCES, CATEGORIES, IGDB_REGIONS } = require('../config/constants');
const { parseIGDBDate } = require('../utils/date');

const IGDB_IMAGE_BASE_URL = 'https://images.igdb.com/igdb/image/upload/t_cover_big';

/**
 * Formats a clean cover image URL from an IGDB cover object.
 * @param {Object|null} cover 
 * @returns {string|null}
 */
function formatCoverUrl(cover) {
  if (!cover || typeof cover !== 'object') return null;

  if (cover.image_id) {
    return `${IGDB_IMAGE_BASE_URL}/${cover.image_id}.jpg`;
  }

  if (cover.url && typeof cover.url === 'string') {
    let url = cover.url;
    if (url.startsWith('//')) {
      url = `https:${url}`;
    }
    return url.replace('t_thumb', 't_cover_big');
  }

  return null;
}

/**
 * Consolidates multiple IGDB release-date records into unified calendar events.
 * 
 * @param {Array<Object>} releaseDateRecords 
 * @returns {Array<Object>} Normalized ReleaseEvent objects
 */
function normalizeIGDBReleaseDates(releaseDateRecords) {
  if (!Array.isArray(releaseDateRecords)) return [];

  const grouped = new Map();

  for (const record of releaseDateRecords) {
    if (!record || typeof record !== 'object') continue;

    const game = record.game;
    if (!game || typeof game !== 'object' || !game.id) continue;

    const dateInfo = parseIGDBDate(record.date);
    if (!dateInfo) continue;

    const groupKey = `${game.id}:${record.date}`;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        game,
        date: dateInfo.date,
        isAllDay: dateInfo.isAllDay,
        timestamp: record.date,
        platforms: new Set(),
        regions: new Set(),
        records: [],
      });
    }

    const entry = grouped.get(groupKey);
    entry.records.push(record);

    if (record.platform?.name) {
      entry.platforms.add(record.platform.name);
    }
    if (record.region !== undefined) {
      const regionName = IGDB_REGIONS[record.region] || `Region ${record.region}`;
      entry.regions.add(regionName);
    }
  }

  const events = [];

  for (const [key, group] of grouped.entries()) {
    const game = group.game;
    const gameTitle = (game.name || 'Untitled Game').trim();
    const platformList = Array.from(group.platforms);
    const regionList = Array.from(group.regions);

    let title = `[Game] ${gameTitle}`;
    if (platformList.length > 0 && platformList.length <= 3) {
      title = `[Game] ${gameTitle} (${platformList.join(', ')})`;
    }

    const descParts = [];
    if (game.summary) {
      descParts.push(game.summary.trim());
    }
    if (platformList.length > 0) {
      descParts.push(`Platforms: ${platformList.join(', ')}`);
    }
    if (regionList.length > 0) {
      descParts.push(`Regions: ${regionList.join(', ')}`);
    }

    const description = descParts.length > 0 ? descParts.join('\n\n') : null;
    const externalId = `game-${game.id}-date-${group.timestamp}`;
    const url = game.url || (game.slug ? `https://www.igdb.com/games/${game.slug}` : `https://www.igdb.com/games/${game.id}`);
    const imageUrl = formatCoverUrl(game.cover);

    events.push({
      externalId,
      source: SOURCES.IGDB,
      category: CATEGORIES.GAME,
      title,
      description,
      releaseDate: group.date,
      isAllDay: group.isAllDay,
      url,
      imageUrl,
      rawMetadata: {
        gameId: game.id,
        gameName: game.name,
        timestamp: group.timestamp,
        platforms: platformList,
        regions: regionList,
        releaseRecords: group.records,
      },
    });
  }

  return events;
}

module.exports = {
  IGDB_IMAGE_BASE_URL,
  formatCoverUrl,
  normalizeIGDBReleaseDates,
};
