const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  fetchUpcomingAnime,
  fetchUpcomingManga,
} = require('../../src/providers/anilist.provider');
const {
  cleanDescription,
  normalizeAnimeAiringSchedule,
  normalizeMangaMedia,
} = require('../../src/normalizers/anilist.normalizer');

describe('AniList Provider Tests', () => {
  describe('HTML Description Cleaner', () => {
    it('strips html tags and decodes common html entities', () => {
      const raw = '<b>Attack on Titan</b><br><br>Humanity fights &quot;Titans&quot; &amp; survives.';
      const cleaned = cleanDescription(raw);
      assert.equal(cleaned, 'Attack on Titan\n\nHumanity fights "Titans" & survives.');
    });

    it('handles null and non-string values gracefully', () => {
      assert.equal(cleanDescription(null), null);
      assert.equal(cleanDescription(undefined), null);
      assert.equal(cleanDescription(123), null);
    });
  });

  describe('Anime Normalization', () => {
    it('correctly normalizes a valid anime airing event', () => {
      const mockSchedule = {
        id: 1535181,
        airingAt: 1774000000,
        episode: 12,
        mediaId: 153518,
        media: {
          id: 153518,
          title: {
            romaji: 'Ore dake Level Up na Ken',
            english: 'Solo Leveling',
            userPreferred: 'Solo Leveling',
          },
          description: '<p>A hunter discovers a secret dungeon.</p>',
          siteUrl: 'https://anilist.co/anime/153518',
          coverImage: {
            extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx153518.jpg',
            large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx153518.jpg',
          },
        },
      };

      const event = normalizeAnimeAiringSchedule(mockSchedule);

      assert.ok(event, 'Event should not be null');
      assert.equal(event.externalId, '1535181');
      assert.equal(event.source, 'anilist');
      assert.equal(event.category, 'anime');
      assert.equal(event.title, '[Anime] Solo Leveling Episode 12');
      assert.equal(event.description, 'A hunter discovers a secret dungeon.');
      assert.equal(event.releaseDate instanceof Date, true);
      assert.equal(event.releaseDate.toISOString(), new Date(1774000000 * 1000).toISOString());
      assert.equal(event.isAllDay, false);
      assert.equal(event.url, 'https://anilist.co/anime/153518');
      assert.equal(event.imageUrl, 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx153518.jpg');
      assert.deepEqual(event.rawMetadata, mockSchedule);
    });

    it('generates a stable deterministic external ID', () => {
      const mockScheduleA = {
        id: 998877,
        airingAt: 1774000000,
        episode: 1,
        media: { id: 500, title: { userPreferred: 'Test Show' } },
      };
      const mockScheduleB = {
        id: null,
        airingAt: 1774000000,
        episode: 1,
        media: { id: 500, title: { userPreferred: 'Test Show' } },
      };

      const eventA = normalizeAnimeAiringSchedule(mockScheduleA);
      const eventB = normalizeAnimeAiringSchedule(mockScheduleB);

      assert.equal(eventA.externalId, '998877');
      assert.equal(eventB.externalId, 'anime-500-ep-1');
    });

    it('handles multiple episodes with distinct identities and titles', () => {
      const mockEp1 = {
        id: 1001,
        airingAt: 1774000000,
        episode: 1,
        media: { id: 50, title: { english: 'Chainsaw Man' } },
      };
      const mockEp2 = {
        id: 1002,
        airingAt: 1774604800,
        episode: 2,
        media: { id: 50, title: { english: 'Chainsaw Man' } },
      };

      const event1 = normalizeAnimeAiringSchedule(mockEp1);
      const event2 = normalizeAnimeAiringSchedule(mockEp2);

      assert.equal(event1.externalId, '1001');
      assert.equal(event1.title, '[Anime] Chainsaw Man Episode 1');
      assert.equal(event2.externalId, '1002');
      assert.equal(event2.title, '[Anime] Chainsaw Man Episode 2');
      assert.notEqual(event1.releaseDate.getTime(), event2.releaseDate.getTime());
    });

    it('skips item if airingAt date is missing or invalid', () => {
      const invalidA = { id: 1, airingAt: null, episode: 1, media: { id: 10 } };
      const invalidB = { id: 2, airingAt: 'invalid', episode: 1, media: { id: 10 } };
      const invalidC = { id: 3, airingAt: 0, episode: 1, media: { id: 10 } };
      const invalidD = { id: 4, airingAt: 1774000000, episode: 1, media: null };

      assert.equal(normalizeAnimeAiringSchedule(invalidA), null);
      assert.equal(normalizeAnimeAiringSchedule(invalidB), null);
      assert.equal(normalizeAnimeAiringSchedule(invalidC), null);
      assert.equal(normalizeAnimeAiringSchedule(invalidD), null);
    });
  });

  describe('Manga Handling & Exclusion', () => {
    it('strictly does NOT convert manga startDate into publication-start release events', () => {
      const mockMangaWithStartDate = {
        id: 30013,
        title: {
          romaji: 'One Piece',
          english: 'One Piece',
          userPreferred: 'One Piece',
        },
        description: 'Pirates searching for treasure.',
        siteUrl: 'https://anilist.co/manga/30013',
        startDate: {
          year: 2026,
          month: 10,
          day: 15,
        },
        coverImage: {
          extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013.jpg',
        },
      };

      const event = normalizeMangaMedia(mockMangaWithStartDate);

      // Must explicitly return null so that publication-start reminders are NOT generated
      assert.equal(event, null);
    });

    it('fetchUpcomingManga returns an empty array from AniList provider', async () => {
      const results = await fetchUpcomingManga();
      assert.deepEqual(results, []);
    });
  });

  describe('API Fetching & Error Handling (Mocked)', () => {
    it('handles successful anime fetch and pagination structure', async () => {
      const mockClient = {
        post: async () => ({
          data: {
            data: {
              Page: {
                pageInfo: { hasNextPage: false, currentPage: 1 },
                airingSchedules: [
                  {
                    id: 501,
                    airingAt: 1774000000,
                    episode: 1,
                    media: { id: 10, title: { english: 'Dan Da Dan' }, siteUrl: 'https://anilist.co/anime/10' },
                  },
                ],
              },
            },
          },
        }),
      };

      const events = await fetchUpcomingAnime({ client: mockClient });
      assert.equal(events.length, 1);
      assert.equal(events[0].title, '[Anime] Dan Da Dan Episode 1');
      assert.equal(events[0].category, 'anime');
    });

    it('collects every anime page beyond 100 records and deduplicates page overlap', async () => {
      let calls = 0;
      const makeSchedule = (id) => ({
        id,
        airingAt: 1774000000 + id,
        episode: id,
        media: { id: id, title: { english: `Show ${id}` } },
      });
      const mockClient = {
        post: async (_url, body) => {
          calls++;
          const page = body.variables.page;
          return {
            data: { data: { Page: {
              pageInfo: { hasNextPage: page < 3, currentPage: page },
              airingSchedules: page === 1
                ? Array.from({ length: 50 }, (_, index) => makeSchedule(index + 1))
                : page === 2
                  ? Array.from({ length: 50 }, (_, index) => makeSchedule(index + 50))
                  : Array.from({ length: 22 }, (_, index) => makeSchedule(index + 100)),
            } } },
          };
        },
      };

      const events = await fetchUpcomingAnime({ client: mockClient });

      assert.equal(calls, 3);
      assert.equal(events.length, 121);
      assert.equal(events.pages, 3);
    });

    it('handles AniList GraphQL errors gracefully by throwing descriptive error', async () => {
      const mockClient = {
        post: async () => ({
          data: {
            errors: [{ message: 'Validation error in query' }],
          },
        }),
      };

      await assert.rejects(
        async () => fetchUpcomingAnime({ client: mockClient }),
        /AniList GraphQL Error: Validation error in query/
      );
    });

    it('handles HTTP 429 rate limit error gracefully', async () => {
      const mockClient = {
        post: async () => {
          const error = new Error('Request failed with status code 429');
          error.response = { status: 429, statusText: 'Too Many Requests' };
          throw error;
        },
      };

      await assert.rejects(
        async () => fetchUpcomingAnime({ client: mockClient }),
        /AniList API rate limit exceeded \(HTTP 429\)/
      );
    });

    it('handles malformed responses gracefully without crashing', async () => {
      const mockClient = {
        post: async () => ({
          data: {
            data: {
              Page: {
                pageInfo: { hasNextPage: false, currentPage: 1 },
                airingSchedules: [
                  { id: null, airingAt: null }, // malformed item
                  {
                    id: 999,
                    airingAt: 1774000000,
                    episode: 5,
                    media: { id: 77, title: { english: 'Valid Show' } },
                  },
                ],
              },
            },
          },
        }),
      };

      const events = await fetchUpcomingAnime({ client: mockClient });
      assert.equal(events.length, 1);
      assert.equal(events[0].title, '[Anime] Valid Show Episode 5');
    });
  });
});
