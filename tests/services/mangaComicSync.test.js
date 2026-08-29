const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { runSync } = require('../../src/services/sync.service');

function provider(source, category) {
  return async ({ calendarWindow }) => {
    assert.ok(calendarWindow.startDate instanceof Date);
    assert.ok(calendarWindow.endDate instanceof Date);
    return [{ externalId: `${source}-1`, source, category, title: `${category} release`, releaseDate: new Date(), isAllDay: true }];
  };
}

describe('manga and comic sync integration', () => {
  it('runs both new categories with the existing providers and one shared window', async () => {
    const windows = [];
    const providers = Object.fromEntries([
      ['anilist', ['anilist', 'anime']], ['tmdb', ['tmdb', 'movie']], ['igdb', ['igdb', 'game']],
      ['mangadex', ['mangadex', 'manga']], ['gcd', ['gcd', 'comic']],
    ].map(([key, [source, category]]) => [key, async (options) => { windows.push(options.calendarWindow); return provider(source, category)(options); }]));
    const outcome = await runSync({ providers, repository: { upsertEventsBatch: async (events) => ({ total: events.length, insertedOrUpdated: events.length }) } });
    assert.equal(outcome.success, true);
    assert.equal(outcome.results.length, 5);
    assert.equal(new Set(windows.map((window) => window.startDate.getTime())).size, 1);
    assert.equal(new Set(windows.map((window) => window.endDate.getTime())).size, 1);
    assert.deepEqual(outcome.results.map((result) => result.name), ['ANILIST', 'TMDB', 'IGDB', 'MANGA', 'COMIC']);
  });

  it('isolates a comic provider failure from manga and legacy providers', async () => {
    const providers = {
      anilist: provider('anilist', 'anime'), tmdb: provider('tmdb', 'movie'), igdb: provider('igdb', 'game'),
      mangadex: provider('mangadex', 'manga'), gcd: async () => { throw new Error('GCD unavailable'); },
    };
    const outcome = await runSync({ providers, repository: { upsertEventsBatch: async (events) => ({ total: events.length, insertedOrUpdated: events.length }) } });
    assert.equal(outcome.success, false);
    assert.deepEqual(outcome.failedProviders, ['comic']);
    assert.ok(outcome.results.find((result) => result.name === 'MANGA').success);
  });
});
