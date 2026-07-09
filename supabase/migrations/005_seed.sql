-- ============================================================
-- Migration 005: Seed Data
-- IIITH Multilingual Speech Corpus Dataset Collection Platform
-- ============================================================
-- Run AFTER all other migrations.
-- Seeds: languages, emotions.
-- Admin/student accounts are created via Supabase Auth Dashboard
-- (see README.md for instructions).
-- ============================================================

-- ─── Languages ────────────────────────────────────────────────────────────────

INSERT INTO public.languages (code, name) VALUES
  ('en', 'English'),
  ('te', 'Telugu'),
  ('hi', 'Hindi')
ON CONFLICT (code) DO NOTHING;

-- ─── Emotions ─────────────────────────────────────────────────────────────────
-- As confirmed by user: Neutral, Happy, Sad, Angry, Fearful, Surprised, Disgusted

INSERT INTO public.emotions (name, is_active) VALUES
  ('Neutral',    true),
  ('Happy',      true),
  ('Sad',        true),
  ('Angry',      true),
  ('Fearful',    true),
  ('Surprised',  true),
  ('Disgusted',  true)
ON CONFLICT (name) DO NOTHING;

-- ─── Notes ────────────────────────────────────────────────────────────────────
-- After running this seed:
--
-- 1. Create user accounts via Supabase Auth Dashboard or CLI:
--    - 1 admin account
--    - 7 student accounts
--
-- 2. After each auth.user is created, insert into public.users:
--    INSERT INTO public.users (auth_uid, name, role)
--    VALUES ('<auth_uid_from_supabase>', 'Student Name', 'student');
--
-- 3. Create a speaker row for each student:
--    INSERT INTO public.speakers (user_id)
--    SELECT id FROM public.users WHERE auth_uid = '<auth_uid>';
--
-- 4. Upload sentence lists via the admin UI (/admin/sentences)
--    or by inserting into public.sentences directly.
--
-- See README.md for full setup instructions.
