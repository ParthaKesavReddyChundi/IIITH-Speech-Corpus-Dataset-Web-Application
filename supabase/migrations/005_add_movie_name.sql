-- ============================================================
-- Migration 005: Add movie_name to sentences
-- ============================================================

ALTER TABLE public.sentences ADD COLUMN IF NOT EXISTS movie_name TEXT;

-- Update get_next_sentence to return movie_name
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
  movie_name      TEXT
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
    s.movie_name
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
