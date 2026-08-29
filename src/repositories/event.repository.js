const { pool } = require('../db/db');
const logger = require('../utils/logger');
const { DatabaseError } = require('../utils/errors');

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

    const queryText = `
      INSERT INTO events (
        id,
        source,
        category,
        external_id,
        title,
        description,
        release_date,
        is_all_day,
        url,
        image_url,
        raw_metadata,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (source, category, external_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        release_date = EXCLUDED.release_date,
        is_all_day = EXCLUDED.is_all_day,
        url = EXCLUDED.url,
        image_url = EXCLUDED.image_url,
        raw_metadata = EXCLUDED.raw_metadata,
        updated_at = NOW()
      RETURNING id, (xmax = 0) AS is_insert;
    `;

    let processedCount = 0;

    for (const event of events) {
      const id = `${event.source}:${event.category}:${event.externalId}`;
      const params = [
        id,
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
      ];

      await client.query(queryText, params);
      processedCount++;
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
      SELECT 
        id, source, category, external_id, title, description,
        release_date, is_all_day, url, image_url, raw_metadata,
        created_at, updated_at
      FROM events
      WHERE release_date >= $1 AND release_date <= $2
      ORDER BY release_date ASC;
      `,
      [startDate, endDate]
    );
    return res.rows;
  } catch (error) {
    throw new DatabaseError('Failed to retrieve events in calendar window', error);
  }
}

module.exports = {
  upsertEventsBatch,
  getEventsInWindow,
};
