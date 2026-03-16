-- brief.dev — Supabase Database Schema
-- Run this in your Supabase SQL editor (https://app.supabase.com → SQL Editor)
-- User IDs come from Clerk (text, not Supabase Auth UUID)

-- ── SE Profiles ──────────────────────────────────────────────────────────────
-- One profile per user. Stores the "your product" sidebar form data.

CREATE TABLE IF NOT EXISTS se_profiles (
  user_id        TEXT        PRIMARY KEY,  -- Clerk userId
  name           TEXT        NOT NULL DEFAULT '',
  company        TEXT        NOT NULL DEFAULT '',
  product        TEXT        NOT NULL DEFAULT '',
  what_it_does   TEXT        NOT NULL DEFAULT '',
  strengths      TEXT        NOT NULL DEFAULT '',
  weaknesses     TEXT        NOT NULL DEFAULT '',
  typical_buyer  TEXT        NOT NULL DEFAULT '',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Briefs ────────────────────────────────────────────────────────────────────
-- One row per agent run. Stores the full cards output for history/replay.

CREATE TABLE IF NOT EXISTS briefs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,           -- Clerk userId
  prospect    TEXT        NOT NULL,           -- prospect company name
  call_type   TEXT        NOT NULL,           -- 'discovery' | 'demo' | 'rfp'
  notes       TEXT        NOT NULL DEFAULT '',
  cards       JSONB       NOT NULL DEFAULT '{}',  -- full card output (snapshot, intelligence, call_prep, email)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS briefs_user_id_created_at
  ON briefs (user_id, created_at DESC);

-- ── Meeting Triggers (Phase 2 — Calendar Integration) ────────────────────────
-- Populated when Google Calendar is connected. Each row = one upcoming meeting
-- that should auto-generate a brief.

CREATE TABLE IF NOT EXISTS meeting_triggers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT        NOT NULL,
  calendar_event_id TEXT,                    -- Google Calendar event ID (dedup)
  meeting_time      TIMESTAMPTZ NOT NULL,    -- when the meeting starts
  company_name      TEXT        NOT NULL,    -- extracted from meeting title/attendees
  call_type         TEXT        NOT NULL DEFAULT 'discovery',
  brief_id          UUID        REFERENCES briefs (id),
  status            TEXT        NOT NULL DEFAULT 'pending',  -- pending | running | complete | failed
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, calendar_event_id)
);

CREATE INDEX IF NOT EXISTS meeting_triggers_user_status
  ON meeting_triggers (user_id, status, meeting_time);

-- ── Google Calendar Tokens (Phase 2) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_tokens (
  user_id       TEXT        PRIMARY KEY,
  access_token  TEXT        NOT NULL,
  refresh_token TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Slack Tokens (Phase 4) ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS slack_tokens (
  user_id       TEXT        PRIMARY KEY,
  access_token  TEXT        NOT NULL,
  channel_id    TEXT        NOT NULL,   -- DM channel or chosen channel
  team_name     TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
