const { SOURCES, CATEGORIES } = require('../config/constants');
const { parseReleaseDate } = require('../utils/date');

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || null;
}

function normalizeComicIssue(issue) {
  if (!issue || typeof issue !== 'object' || issue.id === undefined || issue.id === null) return null;
  const dateInfo = parseReleaseDate(firstString(issue.on_sale_date, issue.onSaleDate));
  if (!dateInfo || String(issue.id).length > 128) return null;
  const series = issue.series && typeof issue.series === 'object' ? issue.series : {};
  const seriesName = firstString(issue.series_name, series.name, issue.title) || 'Untitled Comic';
  const number = firstString(issue.number, issue.issue_number);
  const title = `${seriesName}${number ? ` #${number}` : ''}`;
  return {
    externalId: String(issue.id),
    source: SOURCES.GCD,
    category: CATEGORIES.COMIC,
    title: `[Comic] ${title}`,
    description: firstString(issue.description, issue.issue_title, issue.notes),
    releaseDate: dateInfo.date,
    isAllDay: dateInfo.isAllDay,
    url: firstString(issue.resource_url, issue.url) || `https://www.comics.org/issue/${issue.id}/`,
    imageUrl: firstString(issue.cover_image_url, issue.image_url),
    rawMetadata: {
      issue,
      release: { field: 'on_sale_date', meaning: 'GCD-recorded on-sale date' },
      attribution: 'Data from the Grand Comics Database (CC BY-SA 4.0).',
    },
  };
}

module.exports = { normalizeComicIssue };
