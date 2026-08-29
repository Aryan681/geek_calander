const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { listTrending, getTrendingWindow } = require('../../src/services/trending.service');
const { ValidationError } = require('../../src/utils/errors');
const { listTrending: listRepositoryTrending } = require('../../src/repositories/event.repository');

function row(id, date) {
  return { id, source: 'igdb', category: 'game', external_id: id, title: `Release ${id}`, description: null, release_date: new Date(date), image_url: null, url: null, raw_metadata: { private: true } };
}

describe('Trending service', () => {
  it('supports defaults, every category, every window, limits, and normalization', async () => {
    for (const category of ['all', 'anime', 'movie', 'game']) {
      for (const window of ['day', 'week', 'month']) {
        let received;
        const result = await listTrending({ category, window, limit: '2' }, {
          listTrending: async (filters) => { received = filters; return [row('one', '2026-08-10T00:00:00Z')]; },
        }, new Date('2026-08-10T12:00:00Z'));
        assert.equal(result.category, category);
        assert.equal(result.window, window);
        assert.equal(received.category, category === 'all' ? null : category);
        assert.equal(received.limit, 2);
        assert.equal(result.events[0].releaseDate, '2026-08-10T00:00:00.000Z');
        assert.equal('rawMetadata' in result.events[0], false);
      }
    }
  });

  it('uses deterministic release-date windows and rejects invalid limits/options', async () => {
    const now = new Date('2026-08-10T12:00:00Z');
    assert.deepEqual(getTrendingWindow('week', 'fresh', now), { from: new Date('2026-08-03T12:00:00Z'), to: now });
    assert.deepEqual(getTrendingWindow('week', 'upcoming', now), { from: new Date('2026-08-11T00:00:00Z'), to: new Date('2026-08-18T00:00:00Z') });
    assert.deepEqual(getTrendingWindow('month', 'fresh', now), { from: new Date('2026-07-11T12:00:00Z'), to: now });
    for (const query of [{ category: 'manga' }, { window: 'year' }, { mode: 'popular' }, { limit: '0' }, { limit: '51' }, { limit: 'x' }]) {
      await assert.rejects(() => listTrending(query, { listTrending: async () => [] }), ValidationError);
    }
  });

  it('returns a clean empty event list without manufacturing results', async () => {
    const result = await listTrending({}, { listTrending: async () => [] });
    assert.deepEqual(result.events, []);
  });
});

describe('Trending repository query', () => {
  it('filters in PostgreSQL, orders deterministically, limits output, and excludes raw metadata', async () => {
    const calls = [];
    const client = { query: async (query) => { calls.push(query); return { rows: [row('one', '2026-08-10T00:00:00Z'), row('two', '2026-08-09T00:00:00Z')] }; } };
    const result = await listRepositoryTrending({ from: new Date('2026-08-01Z'), to: new Date('2026-09-01Z'), category: 'anime', mode: 'fresh', limit: 20 }, client);
    assert.equal(result.length, 2);
    assert.equal(calls.length, 1);
    assert.match(calls[0].text, /release_date >= \$1/);
    assert.match(calls[0].text, /release_date < \$2/);
    assert.match(calls[0].text, /category = \$3/);
    assert.match(calls[0].text, /ORDER BY release_date DESC, id DESC/);
    assert.match(calls[0].text, /LIMIT \$4/);
    assert.deepEqual(calls[0].values, [new Date('2026-08-01Z'), new Date('2026-09-01Z'), 'anime', 20]);
    assert.equal(calls[0].text.includes('raw_metadata'), false);
  });
  it('orders upcoming releases nearest first', async () => {
    const client = { query: async (query) => { assert.match(query.text, /ORDER BY release_date ASC, id ASC/); return { rows: [] }; } };
    await listRepositoryTrending({ from: new Date(), to: new Date(), mode: 'upcoming', limit: 1 }, client);
  });
});
