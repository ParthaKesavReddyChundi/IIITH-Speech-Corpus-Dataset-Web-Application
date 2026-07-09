-- ============================================================
-- Migration 001: Schema
-- IIITH Multilingual Speech Corpus Dataset Collection Platform
-- ============================================================
-- Apply with: supabase db push (or copy-paste into Supabase SQL editor)
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enum Types ───────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('admin', 'student');
CREATE TYPE recording_status AS ENUM (
  'draft',
  'uploading',
  'uploaded',
  'verified',
  'failed',
  'flagged_for_rerecord',
  'deleted'
);
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other');
CREATE TYPE language_code AS ENUM ('en', 'te', 'hi');

-- ─── users ────────────────────────────────────────────────────────────────────
-- Maps our application users to Supabase auth.users.
-- admin pre-creates all accounts (no public signup).

CREATE TABLE public.users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_uid    UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 100),
  role        user_role NOT NULL DEFAULT 'student',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS
  'Application users, linked 1:1 to Supabase auth.users. Admin pre-creates all accounts.';
COMMENT ON COLUMN public.users.auth_uid IS
  'References auth.users.id — the Supabase Auth UUID for this user.';

-- ─── speakers ─────────────────────────────────────────────────────────────────
-- One speaker per student user. Allows future multi-speaker extension.

CREATE TABLE public.speakers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE RESTRICT,
  gender_default  gender_type,    -- optional default; students can override per recording
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.speakers IS
  'Speaker profiles. One per student. Linked to users table.';

-- ─── languages ────────────────────────────────────────────────────────────────

CREATE TABLE public.languages (
  id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code  language_code NOT NULL UNIQUE,
  name  TEXT NOT NULL
);

COMMENT ON TABLE public.languages IS
  'Supported languages. Seeded with en/te/hi.';

-- ─── sentences ────────────────────────────────────────────────────────────────
-- Sentence lists uploaded by admin per language.
-- normalized_text: Unicode NFC-normalized, used for ML pipelines.

CREATE TABLE public.sentences (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  language_id      UUID NOT NULL REFERENCES public.languages(id) ON DELETE RESTRICT,
  text             TEXT NOT NULL CHECK (char_length(text) > 0 AND char_length(text) <= 2000),
  normalized_text  TEXT NOT NULL CHECK (char_length(normalized_text) > 0),
  sentence_number  INTEGER NOT NULL CHECK (sentence_number > 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each sentence number must be unique within a language
  UNIQUE (language_id, sentence_number)
);

COMMENT ON TABLE public.sentences IS
  'Sentence corpus per language. Admin uploads via CSV.';
COMMENT ON COLUMN public.sentences.normalized_text IS
  'Unicode NFC-normalized version of text. Used in dataset metadata and filenames.';
COMMENT ON COLUMN public.sentences.sentence_number IS
  'Sequential number within the language, used for dataset filename generation.';

-- ─── emotions ─────────────────────────────────────────────────────────────────

CREATE TABLE public.emotions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE CHECK (char_length(name) > 0 AND char_length(name) <= 50),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE public.emotions IS
  'Emotion labels. Seeded with: Neutral, Happy, Sad, Angry, Fearful, Surprised, Disgusted.';

-- ─── recordings ───────────────────────────────────────────────────────────────
-- The core table. Every recording attempt lives here.

CREATE TABLE public.recordings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  speaker_id        UUID NOT NULL REFERENCES public.speakers(id) ON DELETE RESTRICT,
  sentence_id       UUID NOT NULL REFERENCES public.sentences(id) ON DELETE RESTRICT,
  language_id       UUID NOT NULL REFERENCES public.languages(id) ON DELETE RESTRICT,
  emotion_id        UUID NOT NULL REFERENCES public.emotions(id) ON DELETE RESTRICT,
  gender            gender_type NOT NULL,
  sample_number     INTEGER NOT NULL CHECK (sample_number > 0),

  -- Audio file metadata
  audio_path        TEXT,         -- Supabase Storage path (null until uploaded)
  checksum_sha256   TEXT,         -- SHA-256 hex of the WAV file
  duration_seconds  NUMERIC(6, 3), -- e.g. 4.250
  sample_rate       INTEGER,      -- always 16000 for this corpus
  bit_depth         INTEGER,      -- always 16
  channels          INTEGER,      -- always 1 (mono)

  -- State machine
  status            recording_status NOT NULL DEFAULT 'draft',

  -- Idempotency key: generated client-side per recording attempt.
  -- Retried uploads reuse this key so duplicate rows are impossible.
  client_upload_id  UUID NOT NULL UNIQUE,

  -- Timestamps
  recorded_at       TIMESTAMPTZ,  -- when the student finished recording
  uploaded_at       TIMESTAMPTZ,  -- when storage upload completed
  verified_at       TIMESTAMPTZ,  -- when checksum was confirmed server-side
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.recordings IS
  'All recording attempts. Status tracks lifecycle from draft→verified.';
COMMENT ON COLUMN public.recordings.client_upload_id IS
  'UUIDv4 generated once per recording attempt on the client. Used as upsert key.
   Prevents duplicate rows on retry/reconnect. Must be unique across all rows.';
COMMENT ON COLUMN public.recordings.sample_number IS
  'Sequential number for this speaker+language combination. Used in filename generation.';

-- Prevent duplicate active recordings for the same speaker+sentence.
-- A student can re-record after their previous attempt is soft-deleted or flagged.
-- Design decision: use a partial unique index rather than a table constraint
-- so we can allow multiple rows when the old one is deleted/flagged.
CREATE UNIQUE INDEX recordings_active_unique
  ON public.recordings (speaker_id, sentence_id)
  WHERE status NOT IN ('deleted', 'flagged_for_rerecord');

-- ─── audit_log ────────────────────────────────────────────────────────────────
-- Append-only audit trail for all significant actions.

CREATE TABLE public.audit_log (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,          -- e.g. 'recording.deleted', 'recording.verified'
  target_table   TEXT NOT NULL,
  target_id      UUID,
  metadata       JSONB,                  -- additional context (old status, reason, etc.)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_log IS
  'Append-only audit trail. All significant mutations write here. Never UPDATE/DELETE.';

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recordings_updated_at
  BEFORE UPDATE ON public.recordings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
