-- ============================================================
-- Migration 003: Indexes
-- IIITH Multilingual Speech Corpus Dataset Collection Platform
-- ============================================================
-- Must be applied AFTER 001_schema.sql
-- ============================================================

-- ─── recordings indexes ───────────────────────────────────────────────────────

-- Primary lookup: dashboard queries aggregate by speaker + language + status
CREATE INDEX idx_recordings_speaker_language_status
  ON public.recordings (speaker_id, language_id, status);

-- Admin recording review: filter by language
CREATE INDEX idx_recordings_language_id
  ON public.recordings (language_id);

-- Admin recording review: filter by status
CREATE INDEX idx_recordings_status
  ON public.recordings (status);

-- Admin recording review: filter by emotion
CREATE INDEX idx_recordings_emotion_id
  ON public.recordings (emotion_id);

-- Idempotent upsert lookup (client_upload_id is UNIQUE, so indexed automatically,
-- but an explicit index declaration documents the intent)
-- Note: already UNIQUE-constrained so no extra index needed

-- Export query: find verified recordings efficiently
CREATE INDEX idx_recordings_verified
  ON public.recordings (speaker_id, language_id)
  WHERE status = 'verified';

-- ─── sentences indexes ────────────────────────────────────────────────────────

-- Primary lookup: students fetch sentences by language
CREATE INDEX idx_sentences_language_active
  ON public.sentences (language_id, sentence_number)
  WHERE is_active = true;

-- ─── audit_log indexes ────────────────────────────────────────────────────────

-- Admin audit log queries by target
CREATE INDEX idx_audit_log_target
  ON public.audit_log (target_table, target_id);

-- Admin audit log queries by actor
CREATE INDEX idx_audit_log_actor
  ON public.audit_log (actor_user_id);

-- Time-based audit log browsing
CREATE INDEX idx_audit_log_created_at
  ON public.audit_log (created_at DESC);

-- ─── speakers / users join ────────────────────────────────────────────────────

-- Frequently joined in RLS policies and dashboard queries
CREATE INDEX idx_speakers_user_id
  ON public.speakers (user_id);

CREATE INDEX idx_users_auth_uid
  ON public.users (auth_uid);
