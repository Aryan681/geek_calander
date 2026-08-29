const axios = require('axios');
const logger = require('../utils/logger');
const { ExternalProviderError } = require('../utils/errors');
const { PAGINATION } = require('../config/constants');
const { getCalendarWindow, formatYMD } = require('../utils/date');
const { normalizeComicIssue } = require('../normalizers/gcd.normalizer');

const GCD_API_BASE_URL = 'https://www.comics.org/api';

function isoWeek(date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return { year: day.getUTCFullYear(), week: Math.ceil((((day - yearStart) / 86400000) + 1) / 7) };
}

function weekKeys(startDate, endDate) {
  const keys = [];
  const seen = new Set();
  for (let cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
    const key = isoWeek(cursor);
    const id = `${key.year}-${key.week}`;
    if (!seen.has(id)) { seen.add(id); keys.push(key); }
  }
  const endKey = isoWeek(endDate);
  const endId = `${endKey.year}-${endKey.week}`;
  if (!seen.has(endId)) keys.push(endKey);
  return keys;
}

async function fetchGcdPage(url, client = axios) {
  try {
    const response = await client.get(url, { headers: { Accept: 'application/json' }, timeout: 15000 });
    const data = response.data;
    if (!data || !Array.isArray(data.results) || !('next' in data)) throw new ExternalProviderError('GCD', 'Malformed on-sale response');
    return data;
  } catch (error) {
    if (error instanceof ExternalProviderError) throw error;
    const status = error.response?.status;
    if (status === 429) throw new ExternalProviderError('GCD', 'API rate limit exceeded (HTTP 429)', 429);
    if (status) throw new ExternalProviderError('GCD', `HTTP Error ${status}`, status);
    throw new ExternalProviderError('GCD', `Network Error: ${error.message}`);
  }
}

async function fetchUpcomingComics({
  calendarWindow = getCalendarWindow(),
  maxPages = Number.parseInt(process.env.PAGINATION_GUARD_MAX_PAGES, 10) || PAGINATION.EMERGENCY_MAX_PAGES,
  rateLimitRetries = 3, rateLimitBackoffMs = 5000, requestDelayMs = 250, client = axios,
} = {}) {
  const base = process.env.GCD_API_BASE_URL || GCD_API_BASE_URL;
  const issues = new Map(); let pages = 0; let fetched = 0;
  for (const { year, week } of weekKeys(calendarWindow.startDate, calendarWindow.endDate)) {
    let url = `${base}/issue/on_sale_weekly/${year}/week/${week}/`; let first = true;
    while (url) {
      if (pages >= maxPages) throw new ExternalProviderError('GCD', `Pagination safety guard triggered after ${maxPages} pages`);
      if (!first && requestDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, requestDelayMs));
      let page;
      for (let attempt = 0; ; attempt++) {
        try { page = await fetchGcdPage(url, client); break; }
        catch (error) {
          if (!([429, 500, 502, 503, 504].includes(error.statusCode)) || attempt >= rateLimitRetries) throw error;
          const delay = rateLimitBackoffMs * (attempt + 1);
          logger.warn(`[GCD] transient failure; retry=${attempt + 1}/${rateLimitRetries} backoff_ms=${delay}`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      first = false; pages++; fetched += page.results.length;
      logger.info(`[GCD] week=${year}-W${week} page=${pages} fetched=${page.results.length}`);
      for (const issue of page.results) if (issue?.id !== undefined && issue?.id !== null) issues.set(String(issue.id), issue);
      url = page.next || null;
    }
  }
  const events = []; let invalid = 0;
  for (const issue of issues.values()) {
    const event = normalizeComicIssue(issue);
    if (event && event.releaseDate >= calendarWindow.startDate && event.releaseDate <= calendarWindow.endDate) events.push(event);
    else invalid++;
  }
  Object.defineProperties(events, { pages: { value: pages }, fetched: { value: fetched }, invalid: { value: invalid } });
  return events;
}

module.exports = { GCD_API_BASE_URL, fetchGcdPage, fetchUpcomingComics, normalizeComicIssue, isoWeek };
