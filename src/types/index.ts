/**
 * Application-level TypeScript types.
 *
 * These are UI/domain types derived from database rows but shaped
 * for component consumption — not 1:1 with DB columns.
 */

export type { UserRole, LanguageCode, RecordingStatus, Gender } from "./database";

// ─── Rich joined types (used in UI) ──────────────────────────────────────────

export interface RecordingWithDetails {
  id: string;
  speaker: {
    id: string;
    name: string;
  };
  sentence: {
    id: string;
    text: string;
    normalized_text: string;
    sentence_number: number;
    language: {
      code: string;
      name: string;
    };
  };
  emotion: {
    id: string;
    name: string;
  };
  gender: string;
  sample_number: number;
  status: import("./database").RecordingStatus;
  duration_seconds: number | null;
  recorded_at: string | null;
  uploaded_at: string | null;
  verified_at: string | null;
  audio_path: string | null;
  client_upload_id: string;
}

// ─── Dashboard progress types ─────────────────────────────────────────────────

export interface LanguageProgress {
  language: string;
  languageCode: string;
  total: number;
  completed: number;
  percentage: number;
}

export interface StudentProgress {
  overall: LanguageProgress;
  byLanguage: LanguageProgress[];
}

// ─── Recording UI state machine ───────────────────────────────────────────────

export type RecordingUiState =
  | "idle"          // Waiting for user to start
  | "recording"     // MediaRecorder is active
  | "stopped"       // Recording stopped, raw audio available
  | "converting"    // ffmpeg.wasm converting to WAV
  | "converted"     // WAV ready, awaiting submission
  | "uploading"     // Upload in progress
  | "uploaded"      // Server confirmed receipt (status = uploaded)
  | "verified"      // Server verified checksum (status = verified)
  | "error";        // Something went wrong (see errorMessage)

export interface RecordingSession {
  clientUploadId: string;       // UUIDv4 — idempotency key
  rawBlob: Blob | null;         // Raw WebM/Opus from MediaRecorder
  wavBlob: Blob | null;         // Converted WAV blob
  checksumSha256: string | null;
  durationSeconds: number | null;
  state: RecordingUiState;
  errorMessage: string | null;
  hasPlayedBack: boolean;       // Mandatory playback gate
}

// ─── IndexedDB stored take ────────────────────────────────────────────────────

export interface LocalRecordingTake {
  clientUploadId: string;
  speakerId: string;
  sentenceId: string;
  languageId: string;
  emotionId: string;
  gender: string;
  wavBlob: Blob;
  checksumSha256: string;
  durationSeconds: number;
  recordedAt: string;   // ISO timestamp
  status: "pending_upload" | "uploading" | "uploaded";
  retryCount: number;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
