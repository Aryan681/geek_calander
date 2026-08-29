const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../../src/app');

describe('Events JSON HTTP API', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => new Promise((resolve) => server.close(resolve)));

  it('returns bounded events using the frontend response contract', async () => {
    const response = await fetch(`${baseUrl}/events?from=2026-08-01&to=2026-09-01&limit=250`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const body = await response.json();
    assert.ok(Array.isArray(body.events));
    assert.ok(body.events.length <= 250);
    assert.equal(typeof body.total, 'number');
    assert.ok(body.nextCursor === null || typeof body.nextCursor === 'string');
    for (const event of body.events) {
      assert.deepEqual(Object.keys(event).sort(), [
        'category', 'description', 'externalId', 'externalUrl', 'id', 'imageUrl', 'platforms', 'releaseDate', 'source', 'title',
      ].sort());
      assert.equal('raw_metadata' in event, false);
    }
  });

  it('applies category filtering, search filtering, and keyset continuation', async () => {
    const firstResponse = await fetch(`${baseUrl}/events?from=2026-02-28&to=2027-02-28&category=anime&limit=2`);
    assert.equal(firstResponse.status, 200);
    const first = await firstResponse.json();
    assert.ok(first.events.length > 0);
    assert.ok(first.events.every((event) => event.category === 'anime'));
    assert.ok(first.nextCursor);

    const secondResponse = await fetch(`${baseUrl}/events?from=2026-02-28&to=2027-02-28&category=anime&limit=2&cursor=${encodeURIComponent(first.nextCursor)}`);
    assert.equal(secondResponse.status, 200);
    const second = await secondResponse.json();
    assert.ok(second.events.length > 0);
    assert.ok(second.events.every((event) => event.category === 'anime'));
    assert.equal(new Set([...first.events, ...second.events].map((event) => event.id)).size, first.events.length + second.events.length);

    const searchResponse = await fetch(`${baseUrl}/events?from=2026-02-28&to=2027-02-28&search=naruto&limit=30`);
    assert.equal(searchResponse.status, 200);
    const search = await searchResponse.json();
    assert.ok(search.events.every((event) => event.title.toLowerCase().includes('naruto')));
  });

  it('rejects invalid filters with sanitized HTTP 400 responses', async () => {
    for (const query of [
      'from=bad&to=2026-09-01',
      'from=2026-09-01&to=2026-08-01',
      'from=2026-08-01&to=2026-09-01&category=books',
      'from=2026-08-01&to=2026-09-01&limit=1000000',
      'from=2026-08-01&to=2026-09-01&cursor=bad',
    ]) {
      const response = await fetch(`${baseUrl}/events?${query}`);
      assert.equal(response.status, 400);
      const body = await response.json();
      assert.equal(typeof body.error, 'string');
      assert.equal(JSON.stringify(body).includes('DATABASE_URL'), false);
      assert.equal(JSON.stringify(body).includes('raw_metadata'), false);
    }
  });
});
