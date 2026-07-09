/**
 * Database type definitions for Supabase (IIITH Speech Corpus Platform).
 *
 * These types mirror the exact schema defined in:
 *   supabase/migrations/001_schema.sql
 *
 * NOTE: These are hand-written to match the schema. After your Supabase project
 * is created and migrations applied, you can auto-generate these with:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
 *
 * Auto-generated types will be more complete; these serve as the canonical
 * source of truth during initial development.
 */

export type UserRole = "admin" | "student";
export type LanguageCode = "en" | "te" | "hi";

export type RecordingStatus =
  | "draft"
  | "uploading"
  | "uploaded"
  | "verified"
  | "failed"
  | "flagged_for_rerecord"
  | "deleted";

export type Gender = "male" | "female" | "other";

// ─── Table Row Types ──────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  auth_uid: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface SpeakerRow {
  id: string;
  user_id: string;
  gender_default: Gender | null;
  created_at: string;
}

export interface LanguageRow {
  id: string;
  code: LanguageCode;
  name: string;
}

export interface SentenceRow {
  id: string;
  language_id: string;
  text: string;
  normalized_text: string;
  sentence_number: number;
  is_active: boolean;
  created_at: string;
}

export interface EmotionRow {
  id: string;
  name: string;
  is_active: boolean;
}

export interface RecordingRow {
  id: string;
  speaker_id: string;
  sentence_id: string;
  language_id: string;
  emotion_id: string;
  gender: Gender;
  sample_number: number;
  audio_path: string | null;
  checksum_sha256: string | null;
  duration_seconds: number | null;
  sample_rate: number | null;
  bit_depth: number | null;
  channels: number | null;
  status: RecordingStatus;
  /** UUIDv4 generated client-side once per recording attempt. Used as idempotency key for upserts. */
  client_upload_id: string;
  recorded_at: string | null;
  uploaded_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Supabase Database Generic Type ──────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Omit<UserRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<UserRow, "id">>;
      };
      speakers: {
        Row: SpeakerRow;
        Insert: Omit<SpeakerRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<SpeakerRow, "id">>;
      };
      languages: {
        Row: LanguageRow;
        Insert: Omit<LanguageRow, "id"> & { id?: string };
        Update: Partial<Omit<LanguageRow, "id">>;
      };
      sentences: {
        Row: SentenceRow;
        Insert: Omit<SentenceRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<SentenceRow, "id">>;
      };
      emotions: {
        Row: EmotionRow;
        Insert: Omit<EmotionRow, "id"> & { id?: string };
        Update: Partial<Omit<EmotionRow, "id">>;
      };
      recordings: {
        Row: RecordingRow;
        Insert: Omit<RecordingRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<RecordingRow, "id">>;
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: Omit<AuditLogRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: never; // Audit log is append-only
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_dashboard_progress: {
        Args: { p_speaker_id: string };
        Returns: {
          language_code: string;
          language_name: string;
          total_sentences: number;
          completed: number;
          uploaded: number;
          failed: number;
          flagged: number;
        }[];
      };
      get_next_sentence: {
        Args: { p_speaker_id: string; p_language_id: string };
        Returns: {
          id: string;
          sentence_number: number;
          text: string;
          normalized_text: string;
        };
      };
    };
    Enums: {
      user_role: UserRole;
      recording_status: RecordingStatus;
      gender: Gender;
      language_code: LanguageCode;
    };
  };
}
