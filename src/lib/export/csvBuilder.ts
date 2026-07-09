export function buildCsv(recordings: any[]) {
  const header = ["recording_id", "sentence_id", "sentence_text", "language_code", "emotion", "speaker_id", "gender", "duration_seconds"];
  
  const rows = recordings.map(r => {
    return [
      r.id,
      r.sentences?.id,
      `"${(r.sentences?.text || "").replace(/"/g, '""')}"`,
      r.languages?.code,
      r.emotions?.name,
      r.speakers?.id,
      r.speakers?.gender_default,
      r.duration_seconds
    ].join(",");
  });

  return [header.join(","), ...rows].join("\n");
}
