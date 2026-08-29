const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const app = require('../../src/app');
const { generateCalendarICS } = require('../../src/services/ics.service');
const {
  getCalendarWindow,
  getDynamicCalendarFeed,
  streamDynamicCalendarFeed,
} = require('../../src/services/calendar.service');
const { addCalendarMonths } = require('../../src/utils/date');

describe('Calendar Feed & Express Server Tests', () => {
  let serverInstance;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      serverInstance = http.createServer(app);
      serverInstance.listen(0, '127.0.0.1', () => {
        const port = serverInstance.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => {
      if (serverInstance) {
        serverInstance.close(resolve);
      } else {
        resolve();
      }
    });
  });

  describe('HTTP Endpoints (/health & /calendar.ics)', () => {
    it('GET /health returns 200 with ok status and no sensitive data', async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /application\/json/);

      const data = await res.json();
      assert.equal(data.status, 'ok');
      assert.ok(data.timestamp);
      assert.equal(data.password, undefined);
      assert.equal(data.database, undefined);
    });

    it('GET /calendar.ics returns 200 and Content-Type: text/calendar; charset=utf-8', async () => {
      const res = await fetch(`${baseUrl}/calendar.ics`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'text/calendar; charset=utf-8');
      assert.equal(res.headers.get('cache-control'), 'public, max-age=1800');

      const body = await res.text();
      assert.match(body, /BEGIN:VCALENDAR/);
      assert.match(body, /END:VCALENDAR/);
      assert.match(body, /PRODID:-\/\/Geek Calendar\/\/geek-calendar\/\/EN/);
    });

    it('returns 404 for unmapped category-specific endpoints', async () => {
      const resAnime = await fetch(`${baseUrl}/calendar/anime.ics`);
      assert.equal(resAnime.status, 404);

      const resMovies = await fetch(`${baseUrl}/calendar/movies.ics`);
      assert.equal(resMovies.status, 404);
    });
  });

  describe('ICS Generation Logic & Serialization', () => {
    it('generates a valid empty VCALENDAR when no events exist', () => {
      const ics = generateCalendarICS([]);
      assert.match(ics, /BEGIN:VCALENDAR/);
      assert.match(ics, /PRODID:-\/\/Geek Calendar\/\/geek-calendar\/\/EN/);
      assert.match(ics, /X-WR-CALNAME:Geek Calendar/);
      assert.match(ics, /END:VCALENDAR/);
    });

    it('correctly serializes a timed release event (is_all_day = false) as a point-in-time release without artificial DTEND', () => {
      const mockEvent = {
        id: 'anilist:anime:153518-ep12',
        source: 'anilist',
        category: 'anime',
        title: '[Anime] Solo Leveling Episode 12',
        description: 'Sung Jinwoo faces the dungeon boss.',
        release_date: new Date('2026-03-20T12:00:00.000Z'),
        is_all_day: false,
        url: 'https://anilist.co/anime/153518',
      };

      const ics = generateCalendarICS([mockEvent]);

      assert.match(ics, /BEGIN:VEVENT/);
      assert.match(ics, /UID:anilist:anime:153518-ep12/);
      assert.match(ics, /SUMMARY:\[Anime\] Solo Leveling Episode 12/);
      assert.match(ics, /DESCRIPTION:Sung Jinwoo faces the dungeon boss\.\\n\\nSource: AniList/);
      assert.match(ics, /DTSTART:20260320T120000Z/);
      // RFC 5545 point-in-time: no DTEND property should be emitted
      assert.equal(/DTEND/.test(ics), false, 'Timed release event should not emit DTEND');
      assert.match(ics, /URL(?:;VALUE=URI)?:https:\/\/anilist\.co\/anime\/153518/);
      assert.match(ics, /END:VEVENT/);
    });

    it('correctly serializes a true all-day event (is_all_day = true) without artificial hours', () => {
      const mockMovieEvent = {
        id: 'tmdb:movie:533535',
        source: 'tmdb',
        category: 'movie',
        title: '[Movie] Deadpool & Wolverine',
        description: 'Deadpool joins Wolverine on a multiverse mission.',
        release_date: new Date('2026-07-25T00:00:00.000Z'),
        is_all_day: true,
        url: 'https://www.themoviedb.org/movie/533535',
      };

      const ics = generateCalendarICS([mockMovieEvent]);

      assert.match(ics, /BEGIN:VEVENT/);
      assert.match(ics, /UID:tmdb:movie:533535/);
      assert.match(ics, /SUMMARY:\[Movie\] Deadpool & Wolverine/);
      // All-day in iCalendar uses VALUE=DATE:YYYYMMDD
      assert.match(ics, /DTSTART;VALUE=DATE:20260725/);
      assert.match(ics, /END:VEVENT/);
    });

    it('serializes multiple events from different media categories into the single calendar feed', () => {
      const mockEvents = [
        {
          id: 'anilist:anime:101',
          source: 'anilist',
          category: 'anime',
          title: '[Anime] Dan Da Dan Ep 1',
          release_date: new Date('2026-10-01T15:00:00.000Z'),
          is_all_day: false,
        },
        {
          id: 'tmdb:movie:202',
          source: 'tmdb',
          category: 'movie',
          title: '[Movie] Gladiator II',
          release_date: new Date('2026-11-15T00:00:00.000Z'),
          is_all_day: true,
        },
        {
          id: 'igdb:game:303',
          source: 'igdb',
          category: 'game',
          title: '[Game] Hollow Knight: Silksong (PC, Switch)',
          release_date: new Date('2026-12-01T00:00:00.000Z'),
          is_all_day: true,
        },
      ];

      const ics = generateCalendarICS(mockEvents);

      assert.match(ics, /UID:anilist:anime:101/);
      assert.match(ics, /UID:tmdb:movie:202/);
      assert.match(ics, /UID:igdb:game:303/);
    });

    it('handles missing optional fields (description, url) without errors', () => {
      const minimalEvent = {
        id: 'igdb:game:999',
        source: 'igdb',
        category: 'game',
        title: '[Game] Minimal Event Game',
        release_date: new Date('2026-10-10T00:00:00.000Z'),
        is_all_day: true,
        description: null,
        url: null,
      };

      const ics = generateCalendarICS([minimalEvent]);
      assert.match(ics, /UID:igdb:game:999/);
      assert.match(ics, /SUMMARY:\[Game\] Minimal Event Game/);
      assert.match(ics, /DESCRIPTION:Source: IGDB/);
    });
  });

  describe('Calendar Window Calculation & Service Delegation', () => {
    it('correctly calculates the rolling six-calendar-month window', () => {
      const refDate = new Date('2026-06-01T00:00:00.000Z');
      const { startDate, endDate } = getCalendarWindow(refDate);

      const diffPastDays = Math.round((refDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      const diffFutureDays = Math.round((endDate.getTime() - refDate.getTime()) / (24 * 60 * 60 * 1000));

      assert.equal(diffPastDays, 182);
      assert.equal(diffFutureDays, 183);

      const boundaryWindow = getCalendarWindow(refDate);
      assert.equal(boundaryWindow.startDate.toISOString(), '2025-12-01T00:00:00.000Z');
      assert.equal(boundaryWindow.endDate.toISOString(), '2026-12-01T00:00:00.000Z');
    });

    it('handles month lengths and leap years with calendar-month arithmetic', () => {
      assert.equal(addCalendarMonths(new Date('2026-08-31T12:00:00.000Z'), -6).toISOString(), '2026-02-28T12:00:00.000Z');
      assert.equal(addCalendarMonths(new Date('2024-08-31T12:00:00.000Z'), -6).toISOString(), '2024-02-29T12:00:00.000Z');
      assert.equal(addCalendarMonths(new Date('2026-01-31T12:00:00.000Z'), 1).toISOString(), '2026-02-28T12:00:00.000Z');
    });

    it('delegates to repository window query and returns formatted ICS', async () => {
      const mockRepo = {
        getEventsInWindow: async (start, end) => [
          {
            id: 'tmdb:movie:888',
            source: 'tmdb',
            category: 'movie',
            title: '[Movie] Window Test Movie',
            release_date: new Date('2026-06-15T00:00:00.000Z'),
            is_all_day: true,
          },
        ],
      };

      const ics = await getDynamicCalendarFeed({
        repository: mockRepo,
        referenceDate: new Date('2026-06-01T00:00:00.000Z'),
      });

      assert.match(ics, /UID:tmdb:movie:888/);
      assert.match(ics, /SUMMARY:\[Movie\] Window Test Movie/);
    });
  });

  describe('Bounded Feed Pagination & Streaming', () => {
    it('serializes 1,001 events across bounded pages without duplicates or skipped records', async () => {
      const allEvents = Array.from({ length: 1001 }, (_, index) => ({
        id: `tmdb:movie:${index}`,
        source: 'tmdb',
        category: 'movie',
        title: `Movie ${index}`,
        release_date: new Date(`2026-06-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`),
        is_all_day: true,
      })).sort((a, b) => a.release_date - b.release_date || a.id.localeCompare(b.id));
      const requestedBatches = [];
      const repository = {
        getEventsInWindowBatch: async (start, end, cursor, batchSize) => {
          assert.ok(start instanceof Date);
          assert.ok(end instanceof Date);
          assert.equal(batchSize, 100);
          const startIndex = cursor ? allEvents.findIndex((event) => event.id === cursor.id) + 1 : 0;
          const rows = allEvents.slice(startIndex, startIndex + batchSize);
          requestedBatches.push({ cursor, rows: rows.length });
          const last = rows[rows.length - 1];
          return {
            rows,
            nextCursor: startIndex + rows.length < allEvents.length ? { releaseDate: last.release_date, id: last.id } : null,
          };
        },
      };

      const chunks = [];
      for await (const chunk of streamDynamicCalendarFeed({
        repository,
        referenceDate: new Date('2026-06-01T00:00:00.000Z'),
        batchSize: 100,
      })) {
        chunks.push(chunk);
      }

      const feed = chunks.join('');
      const uids = [...feed.matchAll(/UID:([^\r\n]+)/g)].map((match) => match[1]);
      assert.equal(uids.length, 1001);
      assert.equal(new Set(uids).size, 1001);
      assert.equal(uids[0], allEvents[0].id);
      assert.equal(uids.at(-1), allEvents.at(-1).id);
      assert.equal(requestedBatches.length, 11);
      assert.match(feed, /^BEGIN:VCALENDAR/);
      assert.match(feed, /END:VCALENDAR$/);
    });

    it('emits a complete empty calendar without querying a second page', async () => {
      let calls = 0;
      const chunks = [];
      for await (const chunk of streamDynamicCalendarFeed({
        repository: {
          getEventsInWindowBatch: async () => {
            calls++;
            return { rows: [], nextCursor: null };
          },
        },
      })) chunks.push(chunk);

      const feed = chunks.join('');
      assert.equal(calls, 1);
      assert.equal((feed.match(/BEGIN:VEVENT/g) || []).length, 0);
      assert.match(feed, /BEGIN:VCALENDAR/);
      assert.match(feed, /END:VCALENDAR/);
    });
  });

  describe('Error Handling and Sanitization', () => {
    it('returns HTTP 500 when calendar service fails without leaking internal errors or credentials', async () => {
      const brokenApp = express();
      brokenApp.get('/calendar.ics', async (req, res) => {
        try {
          throw new Error('Database connection failure: postgres://user:secret_pass@localhost:5432/db');
        } catch (err) {
          return res.status(500).json({ error: 'Internal Server Error' });
        }
      });

      const brokenServer = http.createServer(brokenApp);
      await new Promise((resolve) => brokenServer.listen(0, '127.0.0.1', resolve));
      const brokenPort = brokenServer.address().port;

      const res = await fetch(`http://127.0.0.1:${brokenPort}/calendar.ics`);
      assert.equal(res.status, 500);

      const body = await res.json();
      assert.deepEqual(body, { error: 'Internal Server Error' });
      assert.equal(JSON.stringify(body).includes('secret_pass'), false);

      await new Promise((resolve) => brokenServer.close(resolve));
    });
  });
});
