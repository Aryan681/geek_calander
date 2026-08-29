const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../../src/db/db');
const {
  validateEvent,
  deduplicateEvents,
  syncProvider,
  runSync,
} = require('../../src/services/sync.service');
const {
  upsertEventsBatch,
  getEventsInWindow,
} = require('../../src/repositories/event.repository');

describe('Sync Engine & Repository Tests', () => {
  describe('Event Validation', () => {
    it('accepts a fully valid ReleaseEvent', () => {
      const event = {
        externalId: '123',
        source: 'anilist',
        category: 'anime',
        title: '[Anime] Attack on Titan',
        releaseDate: new Date('2026-10-01T00:00:00Z'),
        isAllDay: false,
        url: 'https://anilist.co/anime/123',
        imageUrl: 'https://example.com/cover.jpg',
      };
      const result = validateEvent(event);
      assert.equal(result.valid, true);
    });

    it('rejects events with missing required fields or invalid types', () => {
      assert.equal(validateEvent(null).valid, false);
      assert.equal(validateEvent({}).valid, false);
      assert.equal(validateEvent({ externalId: '', source: 'anilist', category: 'anime', title: 'Test', releaseDate: new Date(), isAllDay: false }).valid, false);
      assert.equal(validateEvent({ externalId: '1', source: 'invalid_source', category: 'anime', title: 'Test', releaseDate: new Date(), isAllDay: false }).valid, false);
      assert.equal(validateEvent({ externalId: '1', source: 'anilist', category: 'invalid_cat', title: 'Test', releaseDate: new Date(), isAllDay: false }).valid, false);
      assert.equal(validateEvent({ externalId: '1', source: 'anilist', category: 'anime', title: '', releaseDate: new Date(), isAllDay: false }).valid, false);
      assert.equal(validateEvent({ externalId: '1', source: 'anilist', category: 'anime', title: 'Test', releaseDate: 'not-a-date', isAllDay: false }).valid, false);
      assert.equal(validateEvent({ externalId: '1', source: 'anilist', category: 'anime', title: 'Test', releaseDate: new Date(), isAllDay: 'yes' }).valid, false);
    });
  });

  describe('Deduplication Strategy', () => {
    it('deduplicates duplicate events within the same provider response keeping the latest', () => {
      const events = [
        {
          externalId: '101',
          source: 'tmdb',
          category: 'movie',
          title: '[Movie] Original Title',
          releaseDate: new Date('2026-10-01Z'),
          isAllDay: true,
        },
        {
          externalId: '101',
          source: 'tmdb',
          category: 'movie',
          title: '[Movie] Updated Title',
          releaseDate: new Date('2026-10-01Z'),
          isAllDay: true,
        },
      ];

      const deduped = deduplicateEvents(events);
      assert.equal(deduped.length, 1);
      assert.equal(deduped[0].title, '[Movie] Updated Title');
    });

    it('preserves distinct events with different externalId or categories', () => {
      const events = [
        { externalId: '101', source: 'anilist', category: 'anime', title: 'Anime 1' },
        { externalId: '102', source: 'anilist', category: 'anime', title: 'Anime 2' },
        { externalId: '101', source: 'igdb', category: 'game', title: 'Game 1' },
      ];

      const deduped = deduplicateEvents(events);
      assert.equal(deduped.length, 3);
    });
  });

  describe('Provider Isolation & Orchestration', () => {
    it('succeeds completely when all 3 providers succeed', async () => {
      const mockProviders = {
        anilist: async () => [
          { externalId: 'a1', source: 'anilist', category: 'anime', title: 'Anime A', releaseDate: new Date(), isAllDay: false },
        ],
        tmdb: async () => [
          { externalId: 'm1', source: 'tmdb', category: 'movie', title: 'Movie M', releaseDate: new Date(), isAllDay: true },
        ],
        igdb: async () => [
          { externalId: 'g1', source: 'igdb', category: 'game', title: 'Game G', releaseDate: new Date(), isAllDay: true },
        ],
      };

      const mockRepo = {
        upsertEventsBatch: async (items) => ({ total: items.length, insertedOrUpdated: items.length }),
      };

      const outcome = await runSync({ providers: mockProviders, repository: mockRepo });

      assert.equal(outcome.success, true);
      assert.equal(outcome.failedProviders.length, 0);
      assert.equal(outcome.results.length, 3);
      assert.equal(outcome.results.every((r) => r.success), true);
    });

    it('isolates failure when one provider fails while others succeed', async () => {
      const mockProviders = {
        anilist: async () => [
          { externalId: 'a1', source: 'anilist', category: 'anime', title: 'Anime A', releaseDate: new Date(), isAllDay: false },
        ],
        tmdb: async () => {
          throw new Error('TMDB 500 Internal Server Error');
        },
        igdb: async () => [
          { externalId: 'g1', source: 'igdb', category: 'game', title: 'Game G', releaseDate: new Date(), isAllDay: true },
        ],
      };

      const mockRepo = {
        upsertEventsBatch: async (items) => ({ total: items.length, insertedOrUpdated: items.length }),
      };

      const outcome = await runSync({ providers: mockProviders, repository: mockRepo });

      assert.equal(outcome.success, false);
      assert.deepEqual(outcome.failedProviders, ['tmdb']);
      assert.equal(outcome.results[0].success, true); // AniList succeeded
      assert.equal(outcome.results[1].success, false); // TMDB failed
      assert.equal(outcome.results[2].success, true); // IGDB succeeded
    });

    it('reports full failure when all providers fail', async () => {
      const mockProviders = {
        anilist: async () => { throw new Error('AniList down'); },
        tmdb: async () => { throw new Error('TMDB down'); },
        igdb: async () => { throw new Error('IGDB down'); },
      };

      const outcome = await runSync({ providers: mockProviders, repository: { upsertEventsBatch: async () => ({}) } });

      assert.equal(outcome.success, false);
      assert.deepEqual(outcome.failedProviders, ['anilist', 'tmdb', 'igdb']);
    });
  });

  describe('PostgreSQL Database Upsert & Transaction Semantics', () => {
    const testEvent = {
      externalId: 'sync-test-999',
      source: 'anilist',
      category: 'anime',
      title: '[Anime] Initial Sync Test Event',
      description: 'Initial description',
      releaseDate: new Date('2026-11-01T12:00:00Z'),
      isAllDay: false,
      url: 'https://anilist.co/anime/999',
      imageUrl: 'https://example.com/sync-cover.jpg',
      rawMetadata: { test: true, version: 1 },
    };

    const cleanup = async () => {
      try {
        await pool.query(
          `DELETE FROM events WHERE id = $1 OR (source = $2 AND category = $3 AND external_id = $4)`,
          [`${testEvent.source}:${testEvent.category}:${testEvent.externalId}`, testEvent.source, testEvent.category, testEvent.externalId]
        );
      } catch (e) {
        // ignore
      }
    };

    before(async () => {
      await cleanup();
    });

    after(async () => {
      await cleanup();
      await pool.end();
    });

    it('inserts a new event and returns proper counts', async () => {
      const res = await upsertEventsBatch([testEvent]);
      assert.equal(res.insertedOrUpdated, 1);

      const dbRes = await pool.query(`SELECT * FROM events WHERE id = $1`, [`anilist:anime:sync-test-999`]);
      assert.equal(dbRes.rows.length, 1);
      assert.equal(dbRes.rows[0].title, '[Anime] Initial Sync Test Event');
    });

    it('updates existing event on conflict, modifying updated_at and preserving created_at and id', async () => {
      const initialRow = (await pool.query(`SELECT * FROM events WHERE id = $1`, [`anilist:anime:sync-test-999`])).rows[0];
      const initialCreatedAt = initialRow.created_at;
      const initialUpdatedAt = initialRow.updated_at;

      // Small pause to ensure timestamp advances
      await new Promise((resolve) => setTimeout(resolve, 50));

      const updatedEvent = {
        ...testEvent,
        title: '[Anime] Updated Sync Test Event Title',
        description: 'Updated description on re-sync',
        rawMetadata: { test: true, version: 2 },
      };

      await upsertEventsBatch([updatedEvent]);

      const updatedRow = (await pool.query(`SELECT * FROM events WHERE id = $1`, [`anilist:anime:sync-test-999`])).rows[0];

      assert.equal(updatedRow.id, initialRow.id, 'id must remain unchanged');
      assert.equal(updatedRow.title, '[Anime] Updated Sync Test Event Title');
      assert.equal(updatedRow.description, 'Updated description on re-sync');
      assert.equal(updatedRow.created_at.toISOString(), initialCreatedAt.toISOString(), 'created_at must remain unchanged');
      assert.ok(updatedRow.updated_at.getTime() > initialUpdatedAt.getTime(), 'updated_at must advance on update');
    });

    it('rolls back batch transaction completely if any query in the batch fails', async () => {
      const validEvent = {
        externalId: 'rollback-valid',
        source: 'anilist',
        category: 'anime',
        title: 'Valid Event in Failing Batch',
        releaseDate: new Date(),
        isAllDay: false,
      };

      const failingEvent = {
        externalId: 'rollback-failing',
        source: 'invalid_source_violates_check',
        category: 'anime',
        title: 'Will Violate Check Constraint',
        releaseDate: new Date(),
        isAllDay: false,
      };

      await assert.rejects(
        async () => upsertEventsBatch([validEvent, failingEvent]),
        /events_source_check/
      );

      // Verify validEvent was rolled back and NOT saved
      const checkRes = await pool.query(`SELECT * FROM events WHERE id = $1`, [`anilist:anime:rollback-valid`]);
      assert.equal(checkRes.rows.length, 0, 'Transaction rollback must ensure zero partial records exist');
    });

    it('retrieves events within a specified calendar window', async () => {
      const windowStart = new Date('2026-10-01T00:00:00Z');
      const windowEnd = new Date('2026-12-01T00:00:00Z');

      const events = await getEventsInWindow(windowStart, windowEnd);
      assert.ok(Array.isArray(events));
      const found = events.find((e) => e.id === 'anilist:anime:sync-test-999');
      assert.ok(found, 'Should find the test event within the 2026-11-01 window');
    });
  });
});
