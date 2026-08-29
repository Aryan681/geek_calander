const { CALENDAR_WINDOW } = require('../config/constants');

/**
 * Formats a Date object into UTC YYYY-MM-DD string.
 * @param {Date} date 
 * @returns {string}
 */
function formatYMD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a YYYY-MM-DD or ISO 8601 string into a UTC Date object.
 * Returns null if the date string is missing or invalid.
 * @param {string|null} dateStr 
 * @returns {{ date: Date, isAllDay: boolean } | null}
 */
function parseReleaseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/.exec(trimmed);
  if (!ymdMatch) return null;

  const year = parseInt(ymdMatch[1], 10);
  const month = parseInt(ymdMatch[2], 10);
  const day = parseInt(ymdMatch[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const hasTime = Boolean(ymdMatch[4] !== undefined && ymdMatch[5] !== undefined);
  if (hasTime) {
    const hours = parseInt(ymdMatch[4], 10);
    const minutes = parseInt(ymdMatch[5], 10);
    const seconds = parseInt(ymdMatch[6] || '0', 10);
    const parsedDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    if (isNaN(parsedDate.getTime())) return null;
    return { date: parsedDate, isAllDay: false };
  }

  const parsedDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (isNaN(parsedDate.getTime())) return null;

  return { date: parsedDate, isAllDay: true };
}

/**
 * Parses a Unix timestamp in seconds into a UTC Date object.
 * @param {number|null} timestampSec 
 * @returns {{ date: Date, isAllDay: boolean } | null}
 */
function parseIGDBDate(timestampSec) {
  if (!timestampSec || typeof timestampSec !== 'number' || isNaN(timestampSec) || timestampSec <= 0) {
    return null;
  }

  const date = new Date(timestampSec * 1000);
  if (isNaN(date.getTime())) return null;

  const isMidnightUTC =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0;

  return {
    date,
    isAllDay: isMidnightUTC,
  };
}

/**
 * Adds calendar months while clamping the day to the target month's last day.
 * @param {Date} date
 * @param {number} months
 * @returns {Date}
 */
function addCalendarMonths(date, months) {
  const result = new Date(date.getTime());
  const targetMonth = result.getUTCMonth() + months;
  const targetYear = result.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const originalDay = result.getUTCDate();
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();

  result.setUTCFullYear(targetYear, normalizedMonth, Math.min(originalDay, lastDay));
  return result;
}

function getCalendarMonthWindows(startDate, endDate) {
  const windows = [];
  let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));

  while (cursor <= endDate) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    windows.push({
      startDate: cursor < startDate ? new Date(startDate) : new Date(cursor),
      endDate: monthEnd > endDate ? new Date(endDate) : monthEnd,
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  return windows;
}

/**
 * Calculates the active calendar event window using calendar-month arithmetic.
 * @param {Date} [referenceDate] 
 * @returns {{ startDate: Date, endDate: Date }}
 */
function getCalendarWindow(referenceDate = new Date()) {
  const startDate = addCalendarMonths(referenceDate, -CALENDAR_WINDOW.PAST_MONTHS);
  const endDate = addCalendarMonths(referenceDate, CALENDAR_WINDOW.FUTURE_MONTHS);
  return { startDate, endDate };
}

module.exports = {
  formatYMD,
  parseReleaseDate,
  parseIGDBDate,
  addCalendarMonths,
  getCalendarMonthWindows,
  getCalendarWindow,
};
