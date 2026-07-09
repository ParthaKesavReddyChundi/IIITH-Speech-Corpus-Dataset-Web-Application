-- ============================================================
-- Migration 004: Functions & Triggers
-- IIITH Multilingual Speech Corpus Dataset Collection Platform
-- ============================================================
-- Must be applied AFTER 002_rls.sql
-- ============================================================

-- ─── Audit log trigger function ───────────────────────────────────────────────
-- Automatically writes an audit_log entry on every recording status change.
-- This guarantees every state transition is logged without requiring
-- the application to explicitly insert audit records.

CREATE OR REPLACE FUNCTION public.audit_recording_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_user_id UUID;
BEGIN
  -- Look up the current user's user row (not auth.uid directly)
  SELECT id INTO v_actor_user_id
  FROM public.users
  WHERE auth_uid = auth.uid()
  LIMIT 1;

  -- Only log when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_log (
      actor_user_id,
      action,
      target_table,
      target_id,
      metadata
    ) VALUES (
      v_actor_user_id,
      'recording.status_changed',
      'recordings',
      NEW.id,
      jsonb_build_object(
        'from_status', OLD.status::TEXT,
        'to_status',   NEW.status::TEXT,
        'speaker_id',  NEW.speaker_id,
        'sentence_id', NEW.sentence_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER recordings_audit_status
  AFTER UPDATE ON public.recordings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.audit_recording_status_change();

COMMENT ON FUNCTION public.audit_recording_status_change IS
  'Automatically inserts an audit_log row whenever recordings.status changes.
   Ensures every state machine transition is logged without app-level effort.';

-- ─── Function: get_dashboard_progress ────────────────────────────────────────
-- Returns per-language recording counts for a given speaker.
-- Used by the student dashboard progress bars.
-- Returns verified + uploaded counts (uploaded = awaiting server verification).

CREATE OR REPLACE FUNCTION public.get_dashboard_progress(p_speaker_id UUID)
RETURNS TABLE (
  language_code   TEXT,
  language_name   TEXT,
  total_sentences BIGINT,
  completed       BIGINT,
  uploaded        BIGINT,
  failed          BIGINT,
  flagged         BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    l.code::TEXT          AS language_code,
    l.name                AS language_name,
    COUNT(DISTINCT s.id)  AS total_sentences,
    COUNT(r.id) FILTER (
      WHERE r.status IN ('verified', 'uploaded')
    )                     AS completed,
    COUNT(r.id) FILTER (
      WHERE r.status = 'uploaded'
    )                     AS uploaded,
    COUNT(r.id) FILTER (
      WHERE r.status = 'failed'
    )                     AS failed,
    COUNT(r.id) FILTER (
      WHERE r.status = 'flagged_for_rerecord'
    )                     AS flagged
  FROM public.languages l
  JOIN public.sentences s ON s.language_id = l.id AND s.is_active = true
  LEFT JOIN public.recordings r
    ON r.sentence_id = s.id
    AND r.speaker_id = p_speaker_id
    AND r.status NOT IN ('deleted', 'draft')
  GROUP BY l.id, l.code, l.name
  ORDER BY l.code;
$$;

COMMENT ON FUNCTION public.get_dashboard_progress IS
  'Returns per-language recording progress for a speaker. Used by student dashboard.';

-- ─── Function: get_next_sentence ──────────────────────────────────────────────
-- Returns the next sentence to record for a given speaker+language.
-- Skips sentences that already have a non-deleted, non-flagged recording.

CREATE OR REPLACE FUNCTION public.get_next_sentence(
  p_speaker_id  UUID,
  p_language_id UUID
)
RETURNS TABLE (
  sentence_id     UUID,
  sentence_number INTEGER,
  text            TEXT,
  normalized_text TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    s.id              AS sentence_id,
    s.sentence_number,
    s.text,
    s.normalized_text
  FROM public.sentences s
  WHERE
    s.language_id = p_language_id
    AND s.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.recordings r
      WHERE r.sentence_id = s.id
        AND r.speaker_id  = p_speaker_id
        AND r.status NOT IN ('deleted', 'flagged_for_rerecord', 'failed')
    )
  ORDER BY s.sentence_number
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_next_sentence IS
  'Returns the next unrecorded sentence for a speaker+language. Skips completed ones.';

-- ─── Function: compute_sample_number ─────────────────────────────────────────
-- Computes the next sample number for a speaker+language combination.
-- Called server-side when a new recording row is created.

CREATE OR REPLACE FUNCTION public.compute_next_sample_number(
  p_speaker_id  UUID,
  p_language_id UUID
)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(MAX(sample_number), 0) + 1
  FROM public.recordings
  WHERE speaker_id  = p_speaker_id
    AND language_id = p_language_id;
$$;
