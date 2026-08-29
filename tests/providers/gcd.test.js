const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { normalizeComicIssue } = require('../../src/normalizers/gcd.normalizer');
const { fetchUpcomingComics } = require('../../src/providers/gcd.provider');

const window = { startDate: new Date('2026-08-01T00:00:00Z'), endDate: new Date('2027-02-01T00:00:00Z') };
const issue = (id, date = '2026-08-26') => ({ id, series_name: 'Amazing Test', number: '1', on_sale_date: date, resource_url: `https://www.comics.org/issue/${id}/` });

describe('GCD provider', () => {
  it('normalizes on-sale date and rejects missing dates/ids', () => {
    const event = normalizeComicIssue(issue(10));
    assert.equal(event.category, 'comic'); assert.equal(event.source, 'gcd'); assert.equal(event.externalId, '10');
    assert.equal(normalizeComicIssue(issue(11, null)), null); assert.equal(normalizeComicIssue({ on_sale_date: '2026-09-05' }), null);
  });

  it('follows pagination for every week and deduplicates issue ids', async () => {
    let calls = 0;
    const client = { get: async () => { calls++; return { data: { results: calls === 1 ? [issue(1), issue(2)] : [issue(2), issue(3)], next: calls === 1 ? 'https://www.comics.org/api/issue/on_sale_weekly/2026/week/35/?page=2' : null } }; } };
    const events = await fetchUpcomingComics({ calendarWindow: { startDate: new Date('2026-08-24'), endDate: new Date('2026-08-30') }, client, requestDelayMs: 0 });
    assert.equal(calls, 2); assert.deepEqual(events.map((event) => event.externalId), ['1', '2', '3']); assert.equal(events.pages, 2);
  });
});
