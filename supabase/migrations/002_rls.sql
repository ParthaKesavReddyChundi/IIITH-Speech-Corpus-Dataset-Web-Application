-- ============================================================
-- Migration 002: Row-Level Security (RLS)
-- IIITH Multilingual Speech Corpus Dataset Collection Platform
-- ============================================================
-- Must be applied AFTER 001_schema.sql
-- ============================================================

-- ─── Helper: is_admin() ───────────────────────────────────────────────────────
-- Returns true if the currently authenticated user has the 'admin' role.
-- Used in every RLS policy to grant admin full access.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE auth_uid = auth.uid()
      AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin IS
  'Returns true if the current auth.uid() belongs to an admin user.
   SECURITY DEFINER so it always runs with the function owner''s privileges.';

-- ─── Helper: get_speaker_id() ────────────────────────────────────────────────
-- Returns the speaker.id for the currently authenticated user.
-- Used in RLS policies to scope student access to their own recordings.

CREATE OR REPLACE FUNCTION public.get_my_speaker_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT s.id
  FROM public.speakers s
  JOIN public.users u ON u.id = s.user_id
  WHERE u.auth_uid = auth.uid()
  LIMIT 1;
$$;

-- ─── Enable RLS on all tables ────────────────────────────────────────────────

ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speakers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.languages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentences    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log    ENABLE ROW LEVEL SECURITY;

-- ─── users table policies ─────────────────────────────────────────────────────

-- Admins can do anything with users
CREATE POLICY "admin_all_users" ON public.users
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Students can only read their own user row
CREATE POLICY "student_read_own_user" ON public.users
  FOR SELECT
  TO authenticated
  USING (auth_uid = auth.uid());

-- ─── speakers table policies ──────────────────────────────────────────────────

-- Admins can do anything
CREATE POLICY "admin_all_speakers" ON public.speakers
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Students can read only their own speaker row
CREATE POLICY "student_read_own_speaker" ON public.speakers
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE auth_uid = auth.uid()
    )
  );

-- Students can update only their own speaker row (e.g., default gender)
CREATE POLICY "student_update_own_speaker" ON public.speakers
  FOR UPDATE
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE auth_uid = auth.uid()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE auth_uid = auth.uid()
    )
  );

-- ─── languages table policies (read-only for students) ───────────────────────

-- Everyone authenticated can read languages
CREATE POLICY "authenticated_read_languages" ON public.languages
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify languages
CREATE POLICY "admin_write_languages" ON public.languages
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── sentences table policies ─────────────────────────────────────────────────

-- Everyone authenticated can read active sentences
CREATE POLICY "authenticated_read_active_sentences" ON public.sentences
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin());

-- Only admins can insert/update/delete sentences
CREATE POLICY "admin_write_sentences" ON public.sentences
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── emotions table policies ──────────────────────────────────────────────────

-- Everyone authenticated can read active emotions
CREATE POLICY "authenticated_read_active_emotions" ON public.emotions
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin());

-- Only admins can modify emotions
CREATE POLICY "admin_write_emotions" ON public.emotions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── recordings table policies ────────────────────────────────────────────────

-- Admin sees all recordings
CREATE POLICY "admin_all_recordings" ON public.recordings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Students can SELECT their own recordings (any status)
CREATE POLICY "student_read_own_recordings" ON public.recordings
  FOR SELECT
  TO authenticated
  USING (speaker_id = public.get_my_speaker_id());

-- Students can INSERT new recordings for themselves only
-- Note: client_upload_id uniqueness is enforced at DB level (column UNIQUE constraint)
CREATE POLICY "student_insert_own_recordings" ON public.recordings
  FOR INSERT
  TO authenticated
  WITH CHECK (speaker_id = public.get_my_speaker_id());

-- Students can UPDATE their own recordings (status transitions: draft→uploading etc.)
-- They cannot change speaker_id, sentence_id (immutable after insert)
CREATE POLICY "student_update_own_recordings" ON public.recordings
  FOR UPDATE
  TO authenticated
  USING (speaker_id = public.get_my_speaker_id())
  WITH CHECK (speaker_id = public.get_my_speaker_id());

-- No DELETE permission for students (soft delete only, enforced by admin)

-- ─── audit_log table policies ─────────────────────────────────────────────────

-- Admins can read all audit logs
CREATE POLICY "admin_read_audit_log" ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Everyone authenticated can INSERT audit log entries (writes happen server-side)
-- In practice, inserts come from server-side API routes using service role,
-- but this policy is a safety net.
CREATE POLICY "authenticated_insert_audit_log" ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No UPDATE or DELETE on audit_log (append-only enforced by absence of policies)
