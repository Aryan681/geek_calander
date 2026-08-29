const { pool } = require('../db/db');
const logger = require('../utils/logger');
const { DatabaseError } = require('../utils/errors');
const { CALENDAR_FEED } = require('../config/constants');

/**
 * Upserts a batch of validated ReleaseEvent objects in a single database transaction.
 * 
 * Uses ON CONFLICT (source, category, external_id) to update existing records
 * while preserving id, source, category, external_id, and created_at.
 * 
 * @param {Array<Object>} events - Array of validated ReleaseEvents
 * @param {Object} [clientOverride] - Optional client for testing or nested transactions
 * @returns {Promise<{ total: number, insertedOrUpdated: number }>}
 */
async function upsertEventsBatch(events, clientOverride = null) {
  if (!Array.isArray(events) || events.length === 0) {
    return { total: 0, insertedOrUpdated: 0 };
  }

  const client = clientOverride || await pool.connect();
  const shouldRelease = !clientOverride;

  try {
    if (!clientOverride) {
      await client.query('BEGIN');
    }

    let processedCount = 0;
    const chunkSize = 1000;
    for (let offset = 0; offset < events.length; offset += chunkSize) {
      const chunk = events.slice(offset, offset + chunkSize);
      const params = [];
      const values = chunk.map((event, index) => {
        const base = index * 11;
        params.push(
          `${event.source}:${event.category}:${event.externalId}`,
          event.source,
          event.category,
          String(event.externalId),
          event.title,
          event.description || null,
          event.releaseDate,
          Boolean(event.isAllDay),
          event.url || null,
          event.imageUrl || null,
          event.rawMetadata ? JSON.stringify(event.rawMetadata) : null,
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, NOW(), NOW())`;
      }).join(',');

      await client.query(`
        INSERT INTO events (
          id, source, category, external_id, title, description, release_date,
          is_all_day, url, image_url, raw_metadata, created_at, updated_at
        ) VALUES ${values}
        ON CONFLICT (source, category, external_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          release_date = EXCLUDED.release_date,
          is_all_day = EXCLUDED.is_all_day,
          url = EXCLUDED.url,
          image_url = EXCLUDED.image_url,
          raw_metadata = EXCLUDED.raw_metadata,
          updated_at = NOW();
      `, params);
      processedCount += chunk.length;
    }

    if (!clientOverride) {
      await client.query('COMMIT');
    }

    return {
      total: events.length,
      insertedOrUpdated: processedCount,
    };
  } catch (error) {
    if (!clientOverride) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        logger.error('[DB] Rollback error:', rollbackErr.message);
      }
    }
    throw error;
  } finally {
    if (shouldRelease) {
      client.release();
    }
  }
}

/**
 * Retrieves events within an active calendar window.
 * 
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @param {Object} [clientOverride]
 * @returns {Promise<Array<Object>>}
 */
async function getEventsInWindow(startDate, endDate, clientOverride = null) {
  const client = clientOverride || pool;
  try {
    const res = await client.query(
      `
      SELECT id, source, category, title, description, release_date, is_all_day, url
      FROM events
      WHERE release_date >= $1 AND release_date <= $2
      ORDER BY release_date ASC, id ASC;
      `,
      [startDate, endDate]
    );
    return res.rows;
  } catch (error) {
    throw new DatabaseError('Failed to retrieve events in calendar window', error);
  }
}

/**
 * Retrieves one bounded, deterministically ordered feed page. The cursor is
 * the last (release_date, id) pair returned by the previous page.
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {{ releaseDate: Date|string, id: string }|null} [cursor]
 * @param {number} [batchSize]
 * @param {Object} [clientOverride]
 * @returns {Promise<{ rows: Array<Object>, nextCursor: Object|null, hasMore: boolean }>}
 */
async function getEventsInWindowBatch(
  startDate,
  endDate,
  cursor = null,
  batchSize = CALENDAR_FEED.BATCH_SIZE,
  clientOverride = null
) {
  const client = clientOverride || pool;
  const safeBatchSize = Math.max(1, Math.min(Number.parseInt(batchSize, 10) || CALENDAR_FEED.BATCH_SIZE, 5000));
  const values = [startDate, endDate];
  let cursorClause = '';

  if (cursor) {
    values.push(cursor.releaseDate, cursor.id);
    cursorClause = `AND (release_date > $3 OR (release_date = $3 AND id > $4))`;
  }

  values.push(safeBatchSize + 1);

  try {
    const res = await client.query({
      text: `
        SELECT id, source, category, title, description, release_date, is_all_day, url
        FROM events
        WHERE release_date >= $1
          AND release_date <= $2
          ${cursorClause}
        ORDER BY release_date ASC, id ASC
        LIMIT $${values.length};
      `,
      values,
      statement_timeout: CALENDAR_FEED.QUERY_TIMEOUT_MS,
    });

    const hasMore = res.rows.length > safeBatchSize;
    const rows = hasMore ? res.rows.slice(0, safeBatchSize) : res.rows;
    const last = rows[rows.length - 1];
    return {
      rows,
      hasMore,
      nextCursor: hasMore && last ? { releaseDate: last.release_date, id: last.id } : null,
    };
  } catch (error) {
    throw new DatabaseError('Failed to retrieve calendar feed batch', error);
  }
}

/**
 * Lists frontend event fields using bounded keyset pagination and matching
 * filtered count. raw_metadata is intentionally excluded.
 */
async function listEvents({ from, to, category = null, search = null, cursor = null, limit }, clientOverride = null) {
  const client = clientOverride || pool;
  const values = [from, to];
  const filters = ['release_date >= $1', 'release_date < $2'];

  if (category) {
    values.push(category);
    filters.push(`category = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    filters.push(`title ILIKE $${values.length}`);
  }
  if (cursor) {
    values.push(cursor.releaseDate, cursor.id);
    filters.push(`(release_date > $${values.length - 1} OR (release_date = $${values.length - 1} AND id > $${values.length}))`);
  }

  const pageValues = [...values, limit + 1];
  const countValues = values.slice(0, cursor ? values.length - 2 : values.length);
  const countFilters = filters.slice(0, cursor ? filters.length - 1 : filters.length);
  const limitPlaceholder = `$${pageValues.length}`;
  const pageQuery = {
    text: `
      SELECT id, source, category, external_id, title, description,
             release_date, image_url, url
      FROM events
      WHERE ${filters.join(' AND ')}
      ORDER BY release_date ASC, id ASC
      LIMIT ${limitPlaceholder};
    `,
    values: pageValues,
    statement_timeout: CALENDAR_FEED.QUERY_TIMEOUT_MS,
  };
  const countQuery = {
    text: `SELECT COUNT(*)::int AS total FROM events WHERE ${countFilters.join(' AND ')};`,
    values: countValues,
    statement_timeout: CALENDAR_FEED.QUERY_TIMEOUT_MS,
  };

  try {
    const [pageResult, countResult] = await Promise.all([client.query(pageQuery), client.query(countQuery)]);
    const hasMore = pageResult.rows.length > limit;
    return {
      rows: hasMore ? pageResult.rows.slice(0, limit) : pageResult.rows,
      hasMore,
      total: countResult.rows[0].total,
    };
  } catch (error) {
    throw new DatabaseError('Failed to retrieve events', error);
  }
}

module.exports = {
  upsertEventsBatch,
  getEventsInWindow,
  getEventsInWindowBatch,
  listEvents,
};
