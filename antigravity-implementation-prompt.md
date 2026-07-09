# Implementation Prompt for Antigravity AI
## Project: Multilingual Speech Dataset Collection Platform

You are building a production-quality, full-stack web application from scratch. Read this entire prompt before writing code. Follow it precisely. Do not simplify away reliability, security, or edge-case handling for the sake of speed — this application's entire purpose is to never lose research data.

---

## 1. Selected Architecture (do not deviate)

- **Frontend + API routes:** Next.js 14+ (App Router), TypeScript (strict mode), Tailwind CSS, shadcn/ui components.
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Row-Level Security). No separate backend server.
- **Hosting:** Vercel (frontend + API routes), free tier, deployed via GitHub integration (push to `main` = auto-deploy; PRs get preview deployments).
- **Database/Storage/Auth:** Supabase free tier.
- **Audio transcoding:** 100% client-side. Record via `MediaRecorder` (produces WebM/Opus in most browsers), then convert to **WAV, PCM, mono, 16 kHz, 16-bit** in-browser using `ffmpeg.wasm` (or Web Audio API `OfflineAudioContext` resampling as a fallback) before upload. No server-side transcoding service — keeps the stack fully serverless.
- **Error tracking:** Sentry (free tier), both client and server side.
- **Analytics/monitoring:** Vercel Analytics (free) + Supabase's built-in dashboard logs.

Do not introduce a separate Express/Node backend, a different database, or server-side audio processing (e.g., ffmpeg on a server) — this would break the "free, zero-DevOps" constraint.

---

## 2. Data Model (PostgreSQL via Supabase)

Design normalized tables (exact names may be adapted, but structure must be preserved):

```
users            (id, auth_uid, name, role[admin|student], created_at)
speakers         (id, user_id FK, gender_default, created_at)
languages        (id, code[en|te|hi], name)
sentences        (id, language_id FK, text, normalized_text, sentence_number, is_active, created_at)
emotions         (id, name, is_active)
recordings       (
  id, speaker_id FK, sentence_id FK, language_id FK,
  emotion_id FK, gender, sample_number,
  audio_path, checksum_sha256, duration_seconds,
  sample_rate, bit_depth, channels,
  status[draft|uploading|uploaded|verified|failed|flagged_for_rerecord|deleted],
  client_upload_id (uuid, unique, idempotency key),
  recorded_at, uploaded_at, verified_at,
  created_at, updated_at
)
audit_log        (id, actor_user_id, action, target_table, target_id, metadata jsonb, created_at)
```

Key constraints:
- `UNIQUE (speaker_id, sentence_id)` on `recordings` for the *active* (non-deleted) record — prevents duplicate submissions for the same sentence by the same speaker, but must allow a new row when the old one is soft-deleted/flagged for re-record (use a partial unique index filtered on `status != 'deleted'`).
- `client_upload_id` is generated client-side once per recording attempt and reused on retries, so a network retry cannot create a duplicate row (upsert on this key).
- All FKs `ON DELETE RESTRICT` except where a cascade is explicitly intended (e.g., deleting a sentence should not silently orphan/delete recordings — block it if recordings exist, or require the admin to explicitly reassign/archive).

---

## 3. Authentication & Authorization

- Use Supabase Auth (email + password, admin pre-creates the 7 student accounts + 1 admin account — no public signup).
- Enforce **Row-Level Security** on every table:
  - Students can `SELECT`/`INSERT`/`UPDATE` only rows where `recordings.speaker_id` maps to their own `auth_uid`. No `DELETE` permission for students.
  - Admin role bypasses via a `service_role`-gated set of policies or a `is_admin()` Postgres function checked in every policy.
- Storage bucket policies: no public bucket. All audio access via **signed URLs** with short expiry, generated server-side (API route) after verifying the requester owns the recording or is admin.
- Session handling: auto-refresh tokens; if a session expires mid-recording, **do not discard the in-progress take** — buffer it locally (see Section 5) and prompt re-authentication before upload.
- Rate limit sensitive endpoints (upload, login) using Supabase Edge Function middleware or a simple token-bucket in a Next.js middleware backed by a `rate_limits` table — protects against accidental client retry storms, not just malicious abuse.

---

## 4. Recording Lifecycle State Machine

Every recording must move through explicit, persisted states — this is the backbone of the "never lose data" requirement:

```
draft → recorded → converting → uploading → uploaded → verifying → verified
                                     ↓ (failure at any stage)
                                   failed → (auto-retry, then manual retry UI)

admin action: verified → flagged_for_rerecord → (student re-records) → draft (new attempt)
admin action: verified → deleted (soft delete, audit-logged, ZIP export excludes it)
```

- Every transition is written to `audit_log`.
- `failed` state must expose the failure reason (network, checksum mismatch, storage quota, server error) to the student UI with a retry button.
- No state transition may skip steps — the UI must reflect exactly where a recording is stuck if something goes wrong, rather than presenting a silent success or generic error.

---

## 5. Client-Side Reliability Requirements

- **IndexedDB buffering:** every recorded take (raw + converted WAV blob) is written to IndexedDB *immediately* after stop, before upload begins. On page reload/crash/browser close, the app detects orphaned local takes and offers "Resume/Recover" on next login — this is what actually satisfies "never lose a recording," not just server-side retries.
- **Idempotent upload:** generate `client_upload_id` (UUIDv4) at recording time; the upload API upserts on this key so retried/duplicate network calls cannot create duplicate rows.
- **Checksum verification:** compute SHA-256 of the WAV blob client-side before upload; server recomputes checksum on the stored file after upload and compares; mismatch → status `failed`, automatic single retry, then surfaced to the user.
- **Resumable/chunked upload:** for larger files or poor connections, upload via Supabase Storage's resumable upload (TUS protocol) rather than a single PUT, so a dropped connection doesn't require a full re-upload.
- **`beforeunload` guard:** warn the user before navigating away or closing the tab while a recording is in progress or an upload is not yet confirmed `verified`.
- **Optimistic UI + reconciliation:** show "uploading…" immediately, but reconcile against server-confirmed status on next load — never trust local state alone as the source of truth.

---

## 6. Student Workflow & UI

**Dashboard:**
- Overall / English / Telugu / Hindi progress bars with completion percentages.
- Remaining recordings counter.
- Resume-recovery banner if orphaned local takes are detected (Section 5).

**Recording screen (mobile-first):**
- One sentence at a time, large readable text (handle long Telugu/Hindi/English strings gracefully — wrap, don't truncate).
- Gender selector, Emotion selector (both required before recording is enabled).
- Large icon-based buttons: 🎤 Record, ⏹ Stop, ▶ Play, 🔁 Re-record, ✓ Submit — minimum 44×44px touch targets, WCAG-compliant contrast.
- Visual waveform or level meter during recording (basic, no fancy animation) so students can confirm mic is picking up audio (mitigates "silent recording" edge case).
- Enforce minimum (e.g., 0.5s) and maximum (e.g., 30s, configurable) recording duration; reject and prompt re-record outside these bounds.
- Playback before submit is mandatory — Submit is disabled until the student has played back at least once.
- After Submit: show upload progress, then a clear success confirmation, then auto-advance to next sentence.
- Auto-save progress after every successful submission (already implied by the DB write, but the UI must reflect it — no "save" button needed, no data loss on refresh).

---

## 7. Admin Workflow & UI

- Upload sentence lists (CSV/text) per language, with validation (no empty rows, dedup sentence numbers, Unicode integrity check for Telugu/Hindi).
- Manage languages, emotions, users (CRUD, soft-delete only where recordings reference them).
- Completion dashboard: per-speaker, per-language matrix of progress.
- Recording review: paginated table with inline audio preview, filters (speaker, language, emotion, status), search.
- Delete recording (soft delete, audit-logged, confirmation modal).
- Flag for re-record (transitions state, notifies student via dashboard banner).
- **Export:** trigger dataset ZIP generation as a background job (Next.js API route with streaming response, or a queued Supabase Edge Function if generation is large) — do not block the request/timeout on Vercel's serverless function limits. Show progress/spinner; handle interruption by allowing regeneration rather than requiring a full re-export from scratch if feasible.

---

## 8. Dataset Export Specification

ZIP structure:
```
dataset/
├── README.md              (auto-generated: dataset description, stats, schema, license, citation block)
├── LICENSE                 (CC BY 4.0 or similar, admin-configurable)
├── metadata.csv             (UTF-8 with BOM, RFC 4180 quoting — required for Telugu/Hindi text to render correctly in Excel)
├── metadata.json             (same data, machine-friendly, for ML pipelines)
├── checksums.sha256          (per-file checksums for integrity verification)
└── audio/
    └── {speaker_id}/
        └── {language}/
            └── {speaker_id}_{language}_{sample_number:04d}.wav
```

`metadata.csv` / `.json` columns (minimum, exactly as specified in requirements):
`audio_path, text, normalized_text, language, speaker_id, gender, emotion, sample_number, duration, sample_rate, bit_depth, recorded_timestamp, recording_status`

- Only `verified` (or admin-approved) recordings are included; `deleted`/`flagged_for_rerecord` are excluded.
- Filenames: sanitize any special characters from source text-derived identifiers; never use raw transcript text in filenames (only IDs/numbers) to avoid Unicode/filesystem issues.
- Include dataset statistics in README: total samples, per-language/per-speaker counts, per-emotion distribution, total duration.

---

## 9. Edge Case Handling (must be explicitly implemented, not assumed)

Group and handle each of the following — implement guards, user-facing messages, and recovery paths, not just try/catch swallowing:

**Microphone/browser:** permission denied (clear instructions to re-enable), no mic available, unsupported browser (feature-detect `MediaRecorder`/`getUserMedia`, show fallback message), Safari-specific quirks (Safari's MediaRecorder format support differs — test and handle), Android permission prompts differing from iOS.

**Recording quality:** too short/too long (enforced client-side before allowing submit), silent recording (basic RMS-level check post-recording, warn if near-silent), excessive background noise (warn only — cannot auto-reject reliably).

**Submission integrity:** double-click Submit (disable button on click, idempotency key prevents duplicate row anyway), refresh during upload (IndexedDB recovery), browser close during upload (same), duplicate sentence IDs (DB constraint), skipped/missing sentence (dashboard shows gaps explicitly, not just percentage).

**Network/infra:** timeout, Supabase temporary outage (retry with exponential backoff, clear "service temporarily unavailable, your recording is saved locally" messaging — never say "try again" without confirming local safety), storage quota exceeded (admin alert + graceful student-facing message), auth token expiry mid-session (silent refresh; if refresh fails, preserve local recording and prompt re-login).

**Data integrity:** audio conversion failure (fallback conversion path or explicit failure state with retry), invalid/corrupt WAV post-conversion (validate header + duration before upload), database write failure after successful storage upload (compensating transaction — delete orphaned storage object or mark for reconciliation job), storage write failure after DB row creation (same, inverse).

**Concurrency:** admin deletes a recording while a re-upload for the same `client_upload_id` is in flight (use DB transaction + row versioning/optimistic locking; last consistent state wins, logged).

**Internationalization:** Unicode normalization (NFC) for Telugu/Hindi text end-to-end (DB, filenames, CSV, filenames must avoid raw Unicode — use IDs), very long/short transcripts (UI must not clip or overflow), correct font rendering for Telugu/Hindi in the recording UI (verify web fonts are bundled, not reliant on system fonts).

**Export:** large ZIP generation exceeding serverless function time/memory limits (stream generation, or chunk into multiple downloadable parts if dataset grows), export interrupted (resumable/regenerable, not corrupt partial file), timezone handling (store all timestamps in UTC, display in local time).

**Operational:** simultaneous logins from same student on two devices (allow, but surface a warning if both attempt to record the same sentence — resolved by the unique constraint), unexpected server/function restart mid-request (idempotency keys make this safe to retry).

---

## 10. Performance

- Code-split by route; lazy-load the ffmpeg.wasm bundle only on the recording page (it's large).
- Optimize/compress any images/icons; prefer SVG/icon fonts over raster where possible.
- Use React Server Components for static/dashboard data where feasible; keep recording UI as a client component.
- Debounce/avoid unnecessary re-renders in the recording waveform display.
- Efficient Postgres queries: index `recordings(speaker_id, language_id, status)` for dashboard aggregation queries; use materialized views or cached counts if dashboard queries become slow (unlikely at this scale, but design for it).
- Cache static sentence lists client-side (React Query/SWR) with revalidation.

---

## 11. Security

- All Supabase calls from the client use the anon key with RLS enforced — never expose the service role key to the client.
- Service role key used only in server-side API routes (e.g., signed URL generation, export ZIP generation), stored as a Vercel environment variable, never committed.
- Input validation with Zod (or similar) on every API route and form.
- Sanitize all user-supplied text before rendering (though this is an internal tool, defense-in-depth still applies).
- CSRF protection via Next.js/Supabase defaults; verify signed URL expiry is short (e.g., 5 minutes).
- No storage bucket is public; every file access is authorized per-request.

---

## 12. Folder Structure (skeleton to follow)

```
/app
  /(auth)/login
  /(student)/dashboard
  /(student)/record/[language]
  /(admin)/dashboard
  /(admin)/sentences
  /(admin)/users
  /(admin)/recordings
  /(admin)/export
  /api
    /recordings/upload
    /recordings/[id]/signed-url
    /export/generate
    /export/status
/components
  /recording (RecordButton, Waveform, PlaybackControls, GenderSelector, EmotionSelector)
  /dashboard (ProgressBar, StatCard)
  /admin (RecordingTable, SentenceUploader, UserManager)
  /ui (shadcn components)
/lib
  /supabase (client.ts, server.ts, middleware.ts)
  /audio (recorder.ts, wavConverter.ts, checksum.ts, indexedDbBuffer.ts)
  /export (zipBuilder.ts, csvBuilder.ts, readmeGenerator.ts)
  /validation (zod schemas)
/types
/tests
  /unit
  /integration
  /e2e
```

---

## 13. Testing Requirements

- **Unit tests** (Vitest/Jest): WAV conversion correctness, checksum generation, CSV/README generation, state machine transition logic, Zod validation schemas.
- **Integration tests:** upload API idempotency (duplicate `client_upload_id` doesn't duplicate rows), RLS policies (student A cannot read student B's recordings — test with real Supabase test project), export ZIP structure correctness.
- **E2E tests** (Playwright): full student recording flow (record → playback → submit → next sentence), admin export flow, auth flows including expired-session recovery.
- **Manual QA checklist** (deliverable as a markdown doc): cross-browser (Chrome, Safari, Firefox, Edge), cross-device (Android phone, iPhone, iPad, desktop), mic-permission-denied flow, offline/flaky-network simulation, Unicode rendering check for Telugu/Hindi.

---

## 14. Deliverables Expected From You (Antigravity AI)

1. Full Next.js + Supabase application source code, matching the architecture and folder structure above.
2. Supabase SQL migration files (schema, RLS policies, indexes, functions).
3. Environment variable template (`.env.example`) with every required variable documented.
4. `README.md` at project root: setup instructions, Supabase project setup steps, Vercel deployment steps, how to seed initial admin/student accounts and sentence lists.
5. Manual QA checklist document.
6. All code in strict TypeScript, modular, commented where non-obvious, following the folder structure above.
7. Dark mode support via Tailwind, fully responsive from 320px mobile width up to desktop.

Build the entire application now, following every section of this prompt. Where a decision isn't fully specified above, choose the option that best serves reliability and simplicity, and note the choice in code comments.
