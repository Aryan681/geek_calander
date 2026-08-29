const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getRoulette, getWindow } = require('../../src/services/roulette.service');
const { ValidationError, NotFoundError } = require('../../src/utils/errors');
const { rouletteEvent } = require('../../src/repositories/event.repository');

function row(category = 'game') {
  return {
    id: `${category}:1`, source: category === 'game' ? 'igdb' : category === 'movie' ? 'tmdb' : 'anilist',
    category, external_id: '1', title: 'Real Release', description: 'A description',
    release_date: new Date('2026-08-05T12:00:00.000Z'), image_url: 'https://example.test/art.jpg',
    url: 'https://example.test/release', raw_metadata: { secret: true },
  };
}

describe('Geek Roulette service', () => {
  it('returns one normalized random recommendation for every category', async () => {
    for (const category of ['all', 'anime', 'movie', 'game']) {
      let received;
      const result = await getRoulette({ category, window: 'month', mode: 'random' }, {
        rouletteEvent: async (filters) => { received = filters; return row(category === 'all' ? 'anime' : category); },
      }, new Date('2026-08-10T12:00:00.000Z'));
      assert.equal(result.event.category, category === 'all' ? 'anime' : category);
      assert.equal(received.category, category === 'all' ? null : category);
      assert.equal('rawMetadata' in result.event, false);
    }
  });

  it('supports recent, week, month, and fresh mode filters', async () => {
    let received;
    await getRoulette({ window: 'recent', mode: 'fresh' }, {
      rouletteEvent: async (filters) => { received = filters; return row(); },
    }, new Date('2026-08-10T12:00:00.000Z'));
    assert.equal(received.mode, 'fresh');
    assert.equal(received.from.toISOString(), '2026-07-11T12:00:00.000Z');
    assert.deepEqual(getWindow('week', new Date('2026-08-10T12:00:00.000Z')), {
      from: new Date('2026-08-10T00:00:00.000Z'), to: new Date('2026-08-17T00:00:00.000Z'),
    });
    assert.deepEqual(getWindow('month', new Date('2026-08-10T12:00:00.000Z')), {
      from: new Date('2026-08-01T00:00:00.000Z'), to: new Date('2026-09-01T00:00:00.000Z'),
    });
  });

  it('passes a bounded deduplicated exclude list and handles exhaustion', async () => {
    let received;
    await getRoulette({ exclude: 'game:1,game:1,game:2' }, {
      rouletteEvent: async (filters) => { received = filters; return row(); },
    });
    assert.deepEqual(received.exclude, ['game:1', 'game:2']);
    await assert.rejects(() => getRoulette({}, { rouletteEvent: async () => null }), NotFoundError);
  });

  it('rejects invalid and oversized choices', async () => {
    for (const query of [
      { category: 'unknown' }, { window: 'year' }, { mode: 'popular' },
      { exclude: 'bad id' }, { exclude: Array.from({ length: 51 }, (_, i) => `game:${i}`).join(',') },
    ]) await assert.rejects(() => getRoulette(query, { rouletteEvent: async () => row() }), ValidationError);
  });
});

describe('Geek Roulette repository query', () => {
  it('uses parameterized filters, excludes raw metadata, and avoids ORDER BY RANDOM', async () => {
    const calls = [];
    const client = { query: async (query) => {
      calls.push(query);
      return query.text.includes('COUNT(*)') ? { rows: [{ total: 2 }] } : { rows: [row()] };
    } };
    const result = await rouletteEvent({
      from: new Date('2026-08-01Z'), to: new Date('2026-09-01Z'), category: 'game', mode: 'random', exclude: ['game:1'],
    }, client);
    assert.equal(result.id, 'game:1');
    assert.equal(calls.length, 2);
    assert.match(calls[0].text, /category = \$3/);
    assert.match(calls[0].text, /id <> ALL\(\$4::varchar\[\]\)/);
    assert.equal(calls[0].values[2], 'game');
    assert.deepEqual(calls[0].values[3], ['game:1']);
    assert.match(calls[1].text, /LIMIT 1 OFFSET \$5/);
    assert.equal(calls[1].text.includes('ORDER BY RANDOM'), false);
    assert.equal(calls[1].text.includes('raw_metadata'), false);
  });
});
