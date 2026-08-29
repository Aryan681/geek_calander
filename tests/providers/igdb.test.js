const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  resetTokenCache,
  getTwitchAccessToken,
  queryIGDB,
  fetchUpcomingGames,
} = require('../../src/providers/igdb.provider');
const {
  normalizeIGDBReleaseDates,
} = require('../../src/normalizers/igdb.normalizer');
const { parseIGDBDate } = require('../../src/utils/date');

describe('IGDB Provider Tests', () => {
  const originalClientId = process.env.IGDB_CLIENT_ID;
  const originalClientSecret = process.env.IGDB_CLIENT_SECRET;

  beforeEach(() => {
    resetTokenCache();
    process.env.IGDB_CLIENT_ID = 'mock_client_id_123';
    process.env.IGDB_CLIENT_SECRET = 'mock_client_secret_abc';
  });

  afterEach(() => {
    resetTokenCache();
    if (originalClientId !== undefined) {
      process.env.IGDB_CLIENT_ID = originalClientId;
    } else {
      delete process.env.IGDB_CLIENT_ID;
    }
    if (originalClientSecret !== undefined) {
      process.env.IGDB_CLIENT_SECRET = originalClientSecret;
    } else {
      delete process.env.IGDB_CLIENT_SECRET;
    }
  });

  describe('Twitch OAuth Token Acquisition', () => {
    it('successfully acquires and caches Twitch access token for the in-process lifetime', async () => {
      let postCalls = 0;
      const mockClient = {
        post: async () => {
          postCalls++;
          return {
            data: {
              access_token: 'mock_bearer_token_xyz',
              expires_in: 3600,
              token_type: 'bearer',
            },
          };
        },
      };

      const token1 = await getTwitchAccessToken({ client: mockClient });
      const token2 = await getTwitchAccessToken({ client: mockClient });

      assert.equal(token1, 'mock_bearer_token_xyz');
      assert.equal(token2, 'mock_bearer_token_xyz');
      assert.equal(postCalls, 1, 'Subsequent calls within the same process should reuse in-memory cached token');
    });

    it('handles token acquisition failure without exposing credentials', async () => {
      const mockClient = {
        post: async () => {
          const err = new Error('Request failed with status code 401');
          err.response = { status: 401, statusText: 'Unauthorized' };
          throw err;
        },
      };

      await assert.rejects(
        async () => getTwitchAccessToken({ client: mockClient }),
        /Twitch OAuth Error \(HTTP 401\): Failed to obtain access token/
      );
    });
  });

  describe('Date Parsing and Semantics', () => {
    it('parses IGDB UTC epoch timestamp into Date and flags UTC midnight as isAllDay = true', () => {
      // 1788048000 = 2026-08-30T00:00:00.000Z
      const parsed = parseIGDBDate(1788048000);
      assert.ok(parsed);
      assert.equal(parsed.isAllDay, true);
      assert.equal(parsed.date.toISOString(), '2026-08-30T00:00:00.000Z');
      assert.equal(parsed.date.getUTCFullYear(), 2026);
      assert.equal(parsed.date.getUTCMonth(), 7); // August (0-indexed)
      assert.equal(parsed.date.getUTCDate(), 30);
    });

    it('parses non-midnight timestamps as isAllDay = false preserving exact UTC time', () => {
      // 1788114600 = 2026-08-30T18:30:00.000Z
      const parsed = parseIGDBDate(1788114600);
      assert.ok(parsed);
      assert.equal(parsed.isAllDay, false);
      assert.equal(parsed.date.toISOString(), '2026-08-30T18:30:00.000Z');
    });

    it('returns null for missing or invalid timestamps', () => {
      assert.equal(parseIGDBDate(null), null);
      assert.equal(parseIGDBDate(0), null);
      assert.equal(parseIGDBDate(-100), null);
      assert.equal(parseIGDBDate(NaN), null);
      assert.equal(parseIGDBDate('invalid'), null);
    });
  });

  describe('Game Release Normalization & URL Verification', () => {
    it('correctly normalizes a valid upcoming game release and validates IGDB URL', () => {
      const mockRecords = [
        {
          id: 4001,
          date: 1788048000,
          game: {
            id: 119133,
            name: 'Hollow Knight: Silksong',
            slug: 'hollow-knight-silksong',
            summary: 'Play as Hornet, princess-protector of Hallownest.',
            url: 'https://www.igdb.com/games/hollow-knight-silksong',
            cover: { image_id: 'co1r7f' },
          },
          platform: { name: 'PC' },
          region: 8, // Worldwide
        },
      ];

      const events = normalizeIGDBReleaseDates(mockRecords);

      assert.equal(events.length, 1);
      const event = events[0];
      assert.equal(event.externalId, 'game-119133-date-1788048000');
      assert.equal(event.source, 'igdb');
      assert.equal(event.category, 'game');
      assert.equal(event.title, '[Game] Hollow Knight: Silksong (PC)');
      assert.match(event.description, /Play as Hornet/);
      assert.match(event.description, /Platforms: PC/);
      assert.match(event.description, /Regions: Worldwide/);
      assert.equal(event.isAllDay, true);
      assert.equal(event.releaseDate.toISOString(), '2026-08-30T00:00:00.000Z');
      assert.ok(event.url.startsWith('https://www.igdb.com/games/'), 'URL must be a valid IGDB URL');
      assert.equal(event.url, 'https://www.igdb.com/games/hollow-knight-silksong');
      assert.equal(event.imageUrl, 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg');
    });

    it('generates fallback IGDB URL using game slug or game ID when game.url is missing', () => {
      const mockRecords = [
        {
          id: 4002,
          date: 1788048000,
          game: {
            id: 9999,
            slug: 'custom-game-slug',
            name: 'Custom Game',
            url: null, // missing raw url
          },
          platform: { name: 'PC' },
        },
      ];

      const events = normalizeIGDBReleaseDates(mockRecords);
      assert.equal(events.length, 1);
      assert.equal(events[0].url, 'https://www.igdb.com/games/custom-game-slug');
    });

    it('consolidates multiple platform records for the same game on the same release date into one event', () => {
      const mockRecords = [
        {
          id: 5001,
          date: 1788048000,
          game: { id: 700, name: 'Grand Theft Auto VI', summary: 'Next gen open world.' },
          platform: { name: 'PlayStation 5' },
          region: 8,
        },
        {
          id: 5002,
          date: 1788048000,
          game: { id: 700, name: 'Grand Theft Auto VI', summary: 'Next gen open world.' },
          platform: { name: 'Xbox Series X' },
          region: 8,
        },
      ];

      const events = normalizeIGDBReleaseDates(mockRecords);

      assert.equal(events.length, 1, 'Should consolidate into exactly 1 event for identical date');
      assert.equal(events[0].externalId, 'game-700-date-1788048000');
      assert.equal(events[0].title, '[Game] Grand Theft Auto VI (PlayStation 5, Xbox Series X)');
      assert.match(events[0].description, /Platforms: PlayStation 5, Xbox Series X/);
    });

    it('creates separate events when a game has different release dates for different platforms', () => {
      const mockRecords = [
        {
          id: 6001,
          date: 1788048000, // Date 1 (e.g. PC release)
          game: { id: 800, name: 'Staggered Launch Game' },
          platform: { name: 'PC' },
        },
        {
          id: 6002,
          date: 1790640000, // Date 2 (e.g. Console release 30 days later)
          game: { id: 800, name: 'Staggered Launch Game' },
          platform: { name: 'Nintendo Switch' },
        },
      ];

      const events = normalizeIGDBReleaseDates(mockRecords);

      assert.equal(events.length, 2, 'Should create 2 distinct events for distinct release dates');
      assert.equal(events[0].externalId, 'game-800-date-1788048000');
      assert.equal(events[1].externalId, 'game-800-date-1790640000');
      assert.notEqual(events[0].releaseDate.getTime(), events[1].releaseDate.getTime());
    });

    it('generates a stable deterministic external ID across multiple runs', () => {
      const record = {
        id: 7001,
        date: 1788048000,
        game: { id: 999, name: 'Metroid Prime 4' },
      };

      const events1 = normalizeIGDBReleaseDates([record]);
      const events2 = normalizeIGDBReleaseDates([record]);

      assert.equal(events1[0].externalId, 'game-999-date-1788048000');
      assert.equal(events2[0].externalId, 'game-999-date-1788048000');
    });

    it('filters out records with missing or invalid release dates', () => {
      const records = [
        { id: 8001, date: null, game: { id: 1, name: 'Game A' } },
        { id: 8002, date: -50, game: { id: 2, name: 'Game B' } },
        { id: 8003, date: 1788048000, game: null },
      ];

      const events = normalizeIGDBReleaseDates(records);
      assert.equal(events.length, 0);
    });
  });

  describe('API Handling & Error Resilience (Mocked)', () => {
    it('fetches multiple games in a single efficient Apicalypse request without N+1 calls', async () => {
      let igdbCalls = 0;
      let capturedQuery = '';

      const mockClient = {
        post: async (url, data) => {
          if (url.includes('twitch.tv')) {
            return { data: { access_token: 'mock_token', expires_in: 3600 } };
          }
          igdbCalls++;
          capturedQuery = data;
          return {
            data: [
              {
                id: 1,
                date: 1788048000,
                game: { id: 10, name: 'Game Alpha' },
                platform: { name: 'PC' },
              },
              {
                id: 2,
                date: 1788048000,
                game: { id: 20, name: 'Game Beta' },
                platform: { name: 'PS5' },
              },
            ],
          };
        },
      };

      const events = await fetchUpcomingGames({ client: mockClient });

      assert.equal(igdbCalls, 1, 'Only 1 IGDB API call should be executed for the entire batch');
      assert.match(capturedQuery, /fields id, date, human, platform\.name/);
      assert.match(capturedQuery, /where date >= \d+ & date <= \d+/);
      assert.equal(events.length, 2);
      assert.equal(events[0].title, '[Game] Game Alpha (PC)');
      assert.equal(events[1].title, '[Game] Game Beta (PS5)');
    });

    it('handles HTTP 429 rate-limit error gracefully', async () => {
      const mockClient = {
        post: async (url) => {
          if (url.includes('twitch.tv')) {
            return { data: { access_token: 'mock_token', expires_in: 3600 } };
          }
          const err = new Error('Request failed with status code 429');
          err.response = { status: 429, statusText: 'Too Many Requests' };
          throw err;
        },
      };

      await assert.rejects(
        async () => queryIGDB('/release_dates', 'fields *;', { client: mockClient }),
        /IGDB API rate limit exceeded \(HTTP 429\)/
      );
    });

    it('handles network failure gracefully without crashing', async () => {
      const mockClient = {
        post: async (url) => {
          if (url.includes('twitch.tv')) {
            return { data: { access_token: 'mock_token', expires_in: 3600 } };
          }
          throw new Error('Connection reset by peer');
        },
      };

      await assert.rejects(
        async () => queryIGDB('/release_dates', 'fields *;', { client: mockClient }),
        /IGDB Network Error: Connection reset by peer/
      );
    });

    it('handles malformed non-array IGDB response gracefully', async () => {
      const mockClient = {
        post: async (url) => {
          if (url.includes('twitch.tv')) {
            return { data: { access_token: 'mock_token', expires_in: 3600 } };
          }
          return { data: { error: 'unexpected object' } };
        },
      };

      await assert.rejects(
        async () => queryIGDB('/release_dates', 'fields *;', { client: mockClient }),
        /Malformed response from IGDB API/
      );
    });
  });
});
