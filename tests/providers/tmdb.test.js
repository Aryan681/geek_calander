const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  fetchFromTMDB,
  fetchUpcomingMovies,
} = require('../../src/providers/tmdb.provider');
const {
  resolveRegionalReleaseDate,
  normalizeMovie,
} = require('../../src/normalizers/tmdb.normalizer');
const { parseReleaseDate } = require('../../src/utils/date');

describe('TMDB Provider Tests', () => {
  const originalEnvKey = process.env.TMDB_API_KEY;

  beforeEach(() => {
    process.env.TMDB_API_KEY = 'mock-tmdb-test-key-12345';
  });

  afterEach(() => {
    if (originalEnvKey !== undefined) {
      process.env.TMDB_API_KEY = originalEnvKey;
    } else {
      delete process.env.TMDB_API_KEY;
    }
  });

  describe('Date Parsing and Timezone Stability', () => {
    it('correctly parses date-only strings as UTC start-of-day with isAllDay = true', () => {
      const parsed = parseReleaseDate('2026-11-20');
      assert.ok(parsed);
      assert.equal(parsed.isAllDay, true);
      assert.equal(parsed.date.toISOString(), '2026-11-20T00:00:00.000Z');
      assert.equal(parsed.date.getUTCFullYear(), 2026);
      assert.equal(parsed.date.getUTCMonth(), 10); // 0-indexed November
      assert.equal(parsed.date.getUTCDate(), 20);
    });

    it('correctly parses full ISO timestamps with time', () => {
      const parsed = parseReleaseDate('2026-11-20T18:30:00');
      assert.ok(parsed);
      assert.equal(parsed.isAllDay, false);
      assert.equal(parsed.date.toISOString(), '2026-11-20T18:30:00.000Z');
    });

    it('returns null for missing, empty, or invalid date strings', () => {
      assert.equal(parseReleaseDate(null), null);
      assert.equal(parseReleaseDate(''), null);
      assert.equal(parseReleaseDate('not-a-date'), null);
      assert.equal(parseReleaseDate('2026-13-45'), null);
    });
  });

  describe('Regional Release Resolution (India Focus)', () => {
    it('prefers Indian theatrical release date when available', () => {
      const mockMovie = {
        id: 533535,
        title: 'Deadpool & Wolverine',
        release_date: '2026-07-26', // Global
        release_dates: {
          results: [
            {
              iso_3166_1: 'US',
              release_dates: [{ type: 3, release_date: '2026-07-26T00:00:00.000Z' }],
            },
            {
              iso_3166_1: 'IN',
              release_dates: [{ type: 3, release_date: '2026-07-25T00:00:00.000Z' }],
            },
          ],
        },
      };

      const resolved = resolveRegionalReleaseDate(mockMovie);
      assert.ok(resolved);
      assert.equal(resolved.region, 'IN');
      assert.equal(resolved.releaseDateStr, '2026-07-25T00:00:00.000Z');
    });

    it('falls back to global/primary release date when Indian release is not present', () => {
      const mockMovie = {
        id: 533535,
        title: 'Deadpool & Wolverine',
        release_date: '2026-07-26',
        release_dates: {
          results: [
            {
              iso_3166_1: 'US',
              release_dates: [{ type: 3, release_date: '2026-07-26T00:00:00.000Z' }],
            },
          ],
        },
      };

      const resolved = resolveRegionalReleaseDate(mockMovie);
      assert.ok(resolved);
      assert.equal(resolved.region, 'global');
      assert.equal(resolved.releaseDateStr, '2026-07-26');
    });

    it('falls back to primary release date when release_dates object is completely absent', () => {
      const mockMovie = {
        id: 600,
        title: 'Discover Movie',
        release_date: '2026-12-01',
      };

      const resolved = resolveRegionalReleaseDate(mockMovie);
      assert.ok(resolved);
      assert.equal(resolved.region, 'global');
      assert.equal(resolved.releaseDateStr, '2026-12-01');
    });
  });

  describe('Movie Normalization into ReleaseEvent', () => {
    it('correctly normalizes a valid upcoming movie into ReleaseEvent format', () => {
      const mockMovie = {
        id: 872585,
        title: 'Oppenheimer',
        overview: 'The story of J. Robert Oppenheimer and the Manhattan Project.',
        release_date: '2026-08-15',
        poster_path: '/ptpr0kGAckfWYmFD9KzgCUGW0EG.jpg',
      };

      const event = normalizeMovie(mockMovie);

      assert.ok(event);
      assert.equal(event.externalId, '872585');
      assert.equal(event.source, 'tmdb');
      assert.equal(event.category, 'movie');
      assert.equal(event.title, '[Movie] Oppenheimer');
      assert.equal(event.description, 'The story of J. Robert Oppenheimer and the Manhattan Project.');
      assert.equal(event.isAllDay, true);
      assert.equal(event.releaseDate instanceof Date, true);
      assert.equal(event.releaseDate.toISOString(), '2026-08-15T00:00:00.000Z');
      assert.equal(event.url, 'https://www.themoviedb.org/movie/872585');
      assert.equal(event.imageUrl, 'https://image.tmdb.org/t/p/w780/ptpr0kGAckfWYmFD9KzgCUGW0EG.jpg');
      assert.ok(event.rawMetadata);
    });

    it('generates a stable deterministic external ID based on movie ID', () => {
      const movieA = { id: 101, title: 'Movie 1', release_date: '2026-10-01' };
      const movieB = { id: 101, title: 'Movie 1 (Updated)', release_date: '2026-10-01' };

      const eventA = normalizeMovie(movieA);
      const eventB = normalizeMovie(movieB);

      assert.equal(eventA.externalId, '101');
      assert.equal(eventB.externalId, '101');
      assert.equal(eventA.externalId, eventB.externalId);
    });

    it('returns null when movie has missing or invalid release dates', () => {
      const noDate = { id: 201, title: 'No Date Movie', release_date: null };
      const invalidDate = { id: 202, title: 'Bad Date', release_date: 'invalid-date' };

      assert.equal(normalizeMovie(noDate), null);
      assert.equal(normalizeMovie(invalidDate), null);
    });
  });

  describe('API Handling & Dynamic Window Verification (Mocked)', () => {
    it('dynamically computes primary_release_date.gte and lte based on current date', async () => {
      const capturedParams = [];
      const mockClient = {
        get: async (_url, config) => {
          capturedParams.push(config.params);
          return {
            data: {
              page: 1,
              total_pages: 1,
              results: [],
            },
          };
        },
      };

      await fetchUpcomingMovies({ client: mockClient });

      assert.equal(capturedParams.length, 13);
      assert.equal(capturedParams[0].region, 'IN');
      assert.equal(capturedParams[0]['primary_release_date.gte'], '2026-02-28');
      assert.equal(capturedParams[capturedParams.length - 1]['primary_release_date.lte'], '2027-02-28');

      assert.equal(capturedParams.every((params) => params['primary_release_date.gte'] && params['primary_release_date.lte']), true);
    });

    it('normalizes multiple movies from a mocked discover response in a single HTTP call', async () => {
      let callCount = 0;
      const mockClient = {
        get: async () => {
          callCount++;
          return {
            data: {
              page: 1,
              total_pages: 1,
              results: [
                { id: 1, title: 'Movie One', release_date: '2026-10-10', overview: 'Synopsis 1' },
                { id: 2, title: 'Movie Two', release_date: '2026-10-20', overview: 'Synopsis 2' },
                { id: 3, title: 'Malformed Movie', release_date: null }, // filtered out
              ],
            },
          };
        },
      };

      const events = await fetchUpcomingMovies({ client: mockClient, startDate: '2026-10-10', endDate: '2026-10-20' });

      assert.equal(callCount, 1, 'Only 1 HTTP request should be made for the discover page');
      assert.equal(events.length, 2);
      assert.equal(events[0].title, '[Movie] Movie One');
      assert.equal(events[1].title, '[Movie] Movie Two');
    });

    it('collects every movie page beyond 100 records and deduplicates page overlap', async () => {
      let calls = 0;
      const mockClient = {
        get: async (_url, config) => {
          calls++;
          const page = config.params.page;
          return {
            data: {
              page,
              total_pages: 3,
              results: page === 1
                ? Array.from({ length: 50 }, (_, index) => ({ id: index + 1, title: `Movie ${index + 1}`, release_date: '2026-08-01' }))
                : page === 2
                  ? Array.from({ length: 50 }, (_, index) => ({ id: index + 50, title: `Movie ${index + 50} Updated`, release_date: '2026-08-01' }))
                  : Array.from({ length: 22 }, (_, index) => ({ id: index + 100, title: `Movie ${index + 100}`, release_date: '2026-08-01' })),
            },
          };
        },
      };

      const events = await fetchUpcomingMovies({ client: mockClient, startDate: '2026-08-01', endDate: '2026-08-31' });

      assert.equal(calls, 3);
      assert.equal(events.length, 121);
      assert.equal(events.pages, 3);
      assert.equal(events.find((event) => event.externalId === '50').title, '[Movie] Movie 50 Updated');
    });

    it('excludes normalized movies outside the requested date window', async () => {
      const mockClient = {
        get: async () => ({
          data: {
            page: 1,
            total_pages: 1,
            results: [
              { id: 1, title: 'Inside', release_date: '2026-06-01' },
              { id: 2, title: 'Outside', release_date: '2027-01-01' },
            ],
          },
        }),
      };

      const events = await fetchUpcomingMovies({
        startDate: '2026-05-01',
        endDate: '2026-06-30',
        client: mockClient,
      });

      assert.deepEqual(events.map((event) => event.externalId), ['1']);
    });

    it('handles network / API failure gracefully', async () => {
      const mockClient = {
        get: async () => {
          throw new Error('Connection refused to api.themoviedb.org');
        },
      };

      await assert.rejects(
        async () => fetchFromTMDB('/discover/movie', {}, mockClient),
        /TMDB Network Error: Connection refused/
      );
    });

    it('handles HTTP 429 rate-limit error gracefully without leaking secrets', async () => {
      const mockClient = {
        get: async () => {
          const err = new Error('Request failed with status code 429');
          err.response = { status: 429, statusText: 'Too Many Requests' };
          throw err;
        },
      };

      await assert.rejects(
        async () => fetchFromTMDB('/discover/movie', {}, mockClient),
        /TMDB API rate limit exceeded \(HTTP 429\)/
      );
    });

    it('handles malformed or empty responses gracefully', async () => {
      const mockClient = {
        get: async () => ({
          data: null,
        }),
      };

      await assert.rejects(
        async () => fetchFromTMDB('/discover/movie', {}, mockClient),
        /Malformed response from TMDB API/
      );
    });
  });
});
