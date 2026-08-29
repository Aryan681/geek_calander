-- Geek Calendar V1 Database Schema

CREATE TABLE IF NOT EXISTS events (
    -- Unique primary key deterministically constructed as "{source}:{category}:{external_id}"
    id VARCHAR(128) PRIMARY KEY,

    -- Source data provider
    source VARCHAR(32) NOT NULL CHECK (source IN ('anilist', 'tmdb', 'igdb')),

    -- Media / release category
    category VARCHAR(32) NOT NULL CHECK (category IN ('anime', 'manga', 'movie', 'game')),

    -- Native identifier from the upstream provider
    external_id VARCHAR(128) NOT NULL,

    -- Normalized title for display in calendar
    title VARCHAR(512) NOT NULL,

    -- Normalized description / synopsis / metadata summary
    description TEXT,

    -- Exact release timestamp in UTC (or UTC day boundary for date-only releases)
    release_date TIMESTAMPTZ NOT NULL,

    -- Flag indicating whether the event is an all-day event (release date without specific hour/minute)
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,

    -- Canonical URL to the item or official webpage
    url TEXT,

    -- Cover image / poster / banner URL
    image_url TEXT,

    -- Complete raw provider payload preserved for future extensions and debugging
    raw_metadata JSONB,

    -- Record lifecycle tracking
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint preventing duplicate events across ingestion runs
    CONSTRAINT uq_events_source_category_external_id UNIQUE (source, category, external_id)
);

-- Index for high-performance calendar date window queries
CREATE INDEX IF NOT EXISTS idx_events_release_date ON events (release_date ASC);

-- Supports deterministic keyset pagination for the calendar feed.
CREATE INDEX IF NOT EXISTS idx_events_calendar_release_id ON events (release_date ASC, id ASC);
