# Geek Calendar

Geek Calendar is a backend service and dynamic iCalendar feed aggregator for geek culture releases. It collects upcoming anime episode broadcasts, movie releases, and video game launches across multiple upstream providers, normalizes the dates and metadata, stores them in PostgreSQL as the single source of truth, and dynamically exposes an RFC 5545 `.ics` feed consumed directly by calendar applications like Google Calendar, Apple Calendar, and Outlook.

---

## Key Architecture & Design Principles

- **No Google OAuth / No Google Calendar API**: Calendar clients subscribe to Geek Calendar through a standard webcal / ICS feed URL. The backend does not require OAuth or Google API tokens.
- **PostgreSQL Source of Truth**: All provider ingestions are parsed, validated, and upserted into PostgreSQL with transactional integrity.
- **Dynamic ICS Generation**: `GET /calendar.ics` queries the PostgreSQL database in real time for a rolling window of past 30 days to future 90 days and formats it on-the-fly.
- **RFC 5545 Compliance**:
  - **Timed Events** (e.g. Anime episode broadcasts with exact UTC airing times) emit `DTSTART` with NO artificial `DTEND`.
  - **All-Day Events** (e.g. Movie and game releases specified by date) emit `DTSTART;VALUE=DATE:YYYYMMDD`.
  - **Deterministic UIDs**: Formatted as `{source}:{category}:{external_id}` ensuring calendar clients can deduplicate and update existing events cleanly across resyncs.
- **Clean Layered Architecture**: Strict separation of concerns (Routes → Controllers → Services → Repositories / Providers → Database / APIs).

---

## Data Providers

1. **AniList GraphQL API**
   - Ingests weekly airing anime episode schedules.
   - Preserves exact broadcast timestamps in UTC.
   - Manga publication start dates are explicitly excluded from the calendar feed.

2. **The Movie Database (TMDB) API**
   - Ingests upcoming theatrical and premiere movie releases.
   - Resolves India theatrical release dates (`iso_3166_1 = 'IN'`) with automatic fallback to primary/global release dates.
   - Emits all-day calendar events.

3. **Internet Game Database (IGDB) API (via Twitch OAuth2)**
   - Ingests upcoming video game releases across PC and consoles.
   - Aggregates multiple platform releases on the same date into a unified calendar event with platform tags (e.g., `[Game] Title (PC, PS5)`).
   - Resolves Twitch client credentials with in-memory token caching.

---

## Project Structure

```
geek-calendar/
│
├── src/
│   ├── app.js                         # Express application setup & middleware
│   ├── server.js                      # HTTP server bootstrap & graceful shutdown
│   │
│   ├── config/
│   │   ├── env.js                     # Environment variable validation & config
│   │   └── constants.js               # Enums, categories, source names, constants
│   │
│   ├── routes/
│   │   ├── index.js                   # Master router aggregator
│   │   ├── health.routes.js           # GET /health route definition
│   │   └── calendar.routes.js         # GET /calendar.ics route definition
│   │
│   ├── controllers/
│   │   ├── health.controller.js       # Health endpoint controller
│   │   └── calendar.controller.js     # Calendar feed controller
│   │
│   ├── services/
│   │   ├── calendar.service.js        # Window determination & calendar generation
│   │   ├── ics.service.js             # RFC 5545 iCalendar generation
│   │   └── sync.service.js            # Ingestion orchestration & provider isolation
│   │
│   ├── repositories/
│   │   └── event.repository.js        # PostgreSQL database queries & batch upserts
│   │
│   ├── providers/
│   │   ├── anilist.provider.js        # AniList GraphQL client
│   │   ├── tmdb.provider.js           # TMDB REST client
│   │   └── igdb.provider.js           # IGDB / Twitch OAuth client
│   │
│   ├── normalizers/
│   │   ├── anilist.normalizer.js      # AniList data normalizer
│   │   ├── tmdb.normalizer.js         # TMDB data normalizer & regional resolver
│   │   └── igdb.normalizer.js         # IGDB release dates aggregator & normalizer
│   │
│   ├── middleware/
│   │   ├── error.middleware.js        # Centralized sanitized error handler
│   │   └── not-found.middleware.js    # 404 handler
│   │
│   ├── utils/
│   │   ├── logger.js                  # Centralized structured logger
│   │   ├── date.js                    # Date parsing, UTC formatting, window logic
│   │   ├── validation.js              # Event schema validation & deduplication
│   │   └── errors.js                  # Custom domain & HTTP error classes
│   │
│   ├── db/
│   │   ├── db.js                      # PostgreSQL connection pool & lifecycle
│   │   ├── schema.sql                 # DDL schema definition
│   │   └── migrate.js                 # Migration runner script
│   │
│   └── scripts/
│       └── sync.js                    # CLI runner for provider ingestion
│
├── tests/
│   ├── providers/
│   │   ├── anilist.test.js            # AniList provider & normalizer unit tests
│   │   ├── tmdb.test.js               # TMDB provider & regional resolution tests
│   │   └── igdb.test.js               # IGDB provider & platform aggregation tests
│   ├── services/
│   │   └── syncEngine.test.js         # Sync engine, deduplication, DB transactions tests
│   └── server/
│       └── calendarFeed.test.js       # HTTP routes, ICS generation, window queries tests
│
├── .env.example                       # Example environment variables template
├── .gitignore                         # Production gitignore rules
├── package.json                       # Project dependencies & scripts
└── README.md                          # Documentation
```

---

## Environment Configuration

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Configure the required variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection URI (or discrete `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) |
| `PORT` | No | Express HTTP server port (defaults to `3000`) |
| `NODE_ENV` | No | Environment name (`development`, `production`, `test`) |
| `TMDB_API_KEY` | For Sync | TMDB API Read Access Token or API Key |
| `IGDB_CLIENT_ID` | For Sync | Twitch Developer Client ID |
| `IGDB_CLIENT_SECRET` | For Sync | Twitch Developer Client Secret |

> **Note**: AniList uses a public GraphQL endpoint and does not require an API key.

---

## Setup & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Database Migration
Ensure PostgreSQL is running and execute:
```bash
npm run migrate
```

### 3. Run Ingestion / Sync Manually
To fetch upcoming releases from AniList, TMDB, and IGDB and store them in PostgreSQL:
```bash
npm run sync
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Start Production Server
```bash
npm start
```

---

## API Endpoints

### 1. Health Check
```http
GET /health
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-08-29T12:00:00.000Z"
}
```

### 2. Dynamic Calendar Feed
```http
GET /calendar.ics
```
**Response (200 OK):**
- `Content-Type`: `text/calendar; charset=utf-8`
- `Cache-Control`: `public, max-age=1800`
- `Content-Disposition`: `inline; filename="calendar.ics"`
- Body: Valid RFC 5545 iCalendar data containing events across the rolling past 30 days and future 90 days window.

---

## Subscribing in Google Calendar

1. Open Google Calendar on the web ([calendar.google.com](https://calendar.google.com/)).
2. Next to **Other calendars**, click the **+** button and select **From URL**.
3. Enter your Geek Calendar ICS feed URL (e.g. `https://your-domain.com/calendar.ics`).
4. Click **Add calendar**. Google Calendar will periodically fetch and display all upcoming anime, movie, and video game releases.

---

## Testing

Run the automated test suite:
```bash
npm test
```

All 63+ tests execute natively via Node.js test runner covering:
- Provider API interactions and rate limit handling
- Normalization and deterministic UID generation
- Regional release date preference algorithms
- Platform aggregation for video games
- Event schema validation and deduplication
- Database upserts, rollback transactions, and updated_at tracking
- ICS serialization semantics (point-in-time vs. all-day)
- Express HTTP endpoints and error sanitization
