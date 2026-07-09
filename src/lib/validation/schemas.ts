/**
 * Zod validation schemas — shared between client and server.
 *
 * Import these in:
 * - API route handlers for request body validation
 * - Client-side forms for field-level validation
 *
 * All schemas use strict() to reject unknown keys (defense-in-depth).
 */
import { z } from "zod";

// ─── Enum Schemas ─────────────────────────────────────────────────────────────

export const GenderSchema = z.enum(["male", "female", "other"]);
export const LanguageCodeSchema = z.enum(["en", "te", "hi"]);
export const RecordingStatusSchema = z.enum([
  "draft",
  "uploading",
  "uploaded",
  "verified",
  "failed",
  "flagged_for_rerecord",
  "deleted",
]);

// ─── Recording Upload ──────────────────────────────────────────────────────────

export const RecordingUploadSchema = z
  .object({
    clientUploadId: z.string().uuid("clientUploadId must be a valid UUID v4"),
    speakerId: z.string().uuid(),
    sentenceId: z.string().uuid(),
    languageId: z.string().uuid(),
    emotionId: z.string().uuid(),
    gender: GenderSchema,
    checksumSha256: z
      .string()
      .length(64, "SHA-256 checksum must be exactly 64 hex characters")
      .regex(/^[0-9a-f]+$/i, "Checksum must be hex"),
    durationSeconds: z
      .number()
      .min(0.5, "Recording must be at least 0.5 seconds")
      .max(15, "Recording must be at most 15 seconds"),
    sampleRate: z.literal(16000),
    bitDepth: z.literal(16),
    channels: z.literal(1),
  })
  .strict();

export type RecordingUploadInput = z.infer<typeof RecordingUploadSchema>;

// ─── Sentence CSV Upload ───────────────────────────────────────────────────────

export const SentenceRowSchema = z
  .object({
    sentence_number: z
      .number()
      .int()
      .positive("Sentence number must be a positive integer"),
    text: z.string().min(1, "Sentence text cannot be empty").max(2000),
    normalized_text: z.string().min(1).max(2000).optional(),
    language_code: LanguageCodeSchema,
  })
  .strict();

export type SentenceRowInput = z.infer<typeof SentenceRowSchema>;

// ─── Admin — Create User ──────────────────────────────────────────────────────

export const CreateUserSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    email: z.string().email("Must be a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
    role: z.enum(["admin", "student"]),
    genderDefault: GenderSchema.optional(),
  })
  .strict();

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// ─── Recording Admin Actions ───────────────────────────────────────────────────

export const RecordingActionSchema = z
  .object({
    recordingId: z.string().uuid(),
    action: z.enum(["delete", "flag_for_rerecord", "verify"]),
    reason: z.string().max(500).optional(),
  })
  .strict();

export type RecordingActionInput = z.infer<typeof RecordingActionSchema>;

// ─── Signed URL Request ────────────────────────────────────────────────────────

export const SignedUrlRequestSchema = z
  .object({
    recordingId: z.string().uuid(),
  })
  .strict();

export type SignedUrlRequestInput = z.infer<typeof SignedUrlRequestSchema>;

// ─── Login ─────────────────────────────────────────────────────────────────────

export const LoginSchema = z
  .object({
    email: z.string().email("Must be a valid email address"),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export type LoginInput = z.infer<typeof LoginSchema>;
