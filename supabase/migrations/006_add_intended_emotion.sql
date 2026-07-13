-- ============================================================
-- Migration 006: Add intended_emotion to sentences
-- ============================================================

ALTER TABLE public.sentences ADD COLUMN IF NOT EXISTS intended_emotion TEXT;

-- Update get_next_sentence to return intended_emotion
DROP FUNCTION IF EXISTS public.get_next_sentence(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_next_sentence(
  p_speaker_id  UUID,
  p_language_id UUID
)
RETURNS TABLE (
  sentence_id     UUID,
  sentence_number INTEGER,
  text            TEXT,
  normalized_text TEXT,
  movie_name      TEXT,
  intended_emotion TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    s.id              AS sentence_id,
    s.sentence_number,
    s.text,
    s.normalized_text,
    s.movie_name,
    s.intended_emotion
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
