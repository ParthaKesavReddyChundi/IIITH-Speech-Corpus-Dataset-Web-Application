export function buildCsv(recordings: any[]) {
  const header = ["recording_id", "sentence_id", "sentence_number", "sentence_text", "language_code", "emotion", "speaker_id", "speaker_name", "gender", "duration_seconds", "audio_file_path"];
  
  const rows = recordings.map(r => {
    return [
      r.id,
      r.sentences?.id,
      r.sentences?.sentence_number,
      `"${(r.sentences?.text || "").replace(/"/g, '""')}"`,
      r.languages?.code,
      r.emotions?.name,
      r.speakers?.id,
      `"${(r.speakers?.users?.name || "").replace(/"/g, '""')}"`,
      r.speakers?.gender_default,
      r.duration_seconds,
      r.export_file_path || ""
    ].join(",");
  });

  return [header.join(","), ...rows].join("\n");
}
