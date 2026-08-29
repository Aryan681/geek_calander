const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { listEvents } = require('../../src/services/events.service');
const { ValidationError } = require('../../src/utils/errors');
const { listEvents: listRepositoryEvents } = require('../../src/repositories/event.repository');

function row(index, date = '2026-08-10T12:00:00.000Z') {
  return {
    id: `anilist:anime:${index}`,
    source: 'anilist',
    category: 'anime',
    external_id: String(index),
    title: `Naruto ${index}`,
    description: null,
    release_date: new Date(date),
    image_url: null,
    url: `https://anilist.co/anime/${index}`,
  };
}

function repository(rows, total = rows.length) {
  return { listEvents: async ({ limit }) => ({ rows: rows.slice(0, limit), hasMore: rows.length > limit, total }) };
}

describe('Events JSON API service', () => {
  it('maps database fields to the frontend contract and excludes raw metadata', async () => {
    const result = await listEvents({ from: '2026-08-01', to: '2026-09-01', limit: '1' }, repository([row('405273')]));
    assert.deepEqual(result.events[0], {
      id: 'anilist:anime:405273', source: 'anilist', category: 'anime', externalId: '405273',
      title: 'Naruto 405273', releaseDate: '2026-08-10T12:00:00.000Z', description: null,
      imageUrl: null, platforms: [], externalUrl: 'https://anilist.co/anime/405273',
    });
    assert.equal('rawMetadata' in result.events[0], false);
    assert.equal(result.nextCursor, null);
  });

  it('applies defaults, validates limits/categories/dates, and accepts the maximum limit', async () => {
    let observedLimit;
    const repo = { listEvents: async ({ limit }) => { observedLimit = limit; return { rows: [], hasMore: false, total: 0 }; } };
    await listEvents({ from: '2026-08-01', to: '2026-09-01' }, repo);
    assert.equal(observedLimit, 250);
    await listEvents({ from: '2026-08-01', to: '2026-09-01', limit: '500', category: 'anime' }, repo);
    assert.equal(observedLimit, 500);
    for (const query of [
      { category: 'invalid' }, { from: 'bad', to: '2026-09-01' },
      { from: '2026-08-01', to: 'bad' }, { from: '2026-09-01', to: '2026-08-01' },
      { from: '2026-08-01', to: '2026-09-01', limit: '0' },
      { from: '2026-08-01', to: '2026-09-01', limit: '501' },
      { from: '2026-08-01', to: '2026-09-01', limit: 'not-a-number' },
    ]) {
      await assert.rejects(() => listEvents(query, repo), ValidationError);
    }
  });

  it('supports case-insensitive search and combined filters through the repository contract', async () => {
    let filters;
    const repo = { listEvents: async (received) => { filters = received; return { rows: [row('1')], hasMore: false, total: 1 }; } };
    const result = await listEvents({ from: '2026-08-01', to: '2026-09-01', category: 'anime', search: 'NaRuTo', limit: '30' }, repo);
    assert.equal(result.total, 1);
    assert.equal(filters.category, 'anime');
    assert.equal(filters.search, 'NaRuTo');
    assert.equal(filters.limit, 30);
  });

  it('creates and validates opaque cursors without exposing cursor internals', async () => {
    let call = 0;
    const repo = { listEvents: async () => ({ rows: [row('1')], hasMore: call++ === 0, total: 2 }) };
    const first = await listEvents({ from: '2026-08-01', to: '2026-09-01', limit: '1' }, repo);
    assert.ok(first.nextCursor);
    assert.equal(first.nextCursor.includes('releaseDate'), false);
    const second = await listEvents({ from: '2026-08-01', to: '2026-09-01', limit: '1', cursor: first.nextCursor }, repo);
    assert.equal(second.events.length, 1);
    await assert.rejects(() => listEvents({ from: '2026-08-02', to: '2026-09-01', cursor: first.nextCursor }, repo), ValidationError);
    await assert.rejects(() => listEvents({ from: '2026-08-01', to: '2026-09-01', cursor: 'invalid' }, repo), ValidationError);
  });
});

describe('Events repository query', () => {
  it('uses parameterized keyset filtering, minimal columns, lookahead, and exact matching count', async () => {
    const calls = [];
    const client = { query: async (query) => {
      calls.push(query);
      if (query.text.includes('COUNT(*)')) return { rows: [{ total: 1 }] };
      return { rows: [row('1')] };
    } };
    const result = await listRepositoryEvents({
      from: new Date('2026-08-01Z'), to: new Date('2026-09-01Z'), category: 'anime', search: 'Naruto',
      cursor: { releaseDate: new Date('2026-08-02Z'), id: 'anilist:anime:0' }, limit: 250,
    }, client);
    assert.equal(result.total, 1);
    assert.equal(calls.length, 2);
    const page = calls.find((call) => call.text.includes('ORDER BY'));
    assert.match(page.text, /release_date >= \$1/);
    assert.match(page.text, /release_date < \$2/);
    assert.match(page.text, /release_date > \$5/);
    assert.match(page.text, /id > \$6/);
    assert.match(page.text, /ORDER BY release_date ASC, id ASC/);
    assert.match(page.text, /LIMIT \$7/);
    assert.equal(page.values.at(-1), 251);
    assert.equal(page.text.includes('raw_metadata'), false);
    assert.equal(page.values.includes('%Naruto%'), true);
  });
});
