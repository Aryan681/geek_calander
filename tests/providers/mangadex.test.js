const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { normalizeMangaChapter } = require('../../src/normalizers/mangadex.normalizer');
const { fetchUpcomingManga } = require('../../src/providers/mangadex.provider');

const window = { startDate: new Date('2026-08-01T00:00:00Z'), endDate: new Date('2027-02-01T00:00:00Z') };
const manga = { id: 'm1', type: 'manga', attributes: { title: { en: 'Test Manga' }, coverArtFileName: 'cover.jpg' } };
const chapter = (id, publishAt = '2026-09-01T12:00:00Z') => ({ id, type: 'chapter', attributes: { chapter: '3', publishAt, translatedLanguage: 'en' }, relationships: [{ type: 'manga', id: 'm1' }] });

describe('MangaDex provider', () => {
  it('normalizes only explicit chapter publication timestamps', () => {
    const event = normalizeMangaChapter(chapter('c1'), manga);
    assert.equal(event.category, 'manga');
    assert.equal(event.source, 'mangadex');
    assert.equal(event.externalId, 'c1');
    assert.equal(event.releaseDate.toISOString(), '2026-09-01T12:00:00.000Z');
    assert.equal(normalizeMangaChapter(chapter('c2', null), manga), null);
    assert.equal(normalizeMangaChapter({ id: 'c3', attributes: { publishAt: '2026-09-01' } }, null), null);
  });

  it('follows total-based pagination and deduplicates chapter ids', async () => {
    let calls = 0;
    const client = { get: async (_url, options) => {
      calls++;
      return { data: { result: 'ok', total: 3, data: calls === 1 ? [chapter('c1'), chapter('c2')] : [chapter('c2'), chapter('c3')], included: [manga] } };
    } };
    const events = await fetchUpcomingManga({ calendarWindow: window, perPage: 2, client });
    assert.equal(calls, 2);
    assert.deepEqual(events.map((event) => event.externalId), ['c1', 'c2', 'c3']);
    assert.equal(events.pages, 2);
  });
});
