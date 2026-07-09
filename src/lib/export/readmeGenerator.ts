export function generateReadme(stats: { totalRecordings: number; totalDuration: number; languages: Record<string, number> }) {
  const date = new Date().toISOString().split('T')[0];
  
  const languageStats = Object.entries(stats.languages)
    .map(([lang, count]) => `- ${lang}: ${count} recordings`)
    .join('\n');

  return `# IIITH Speech Corpus Dataset Export
Export Date: ${date}

## Overview
This archive contains verified speech recordings collected via the IIITH Speech Corpus Platform.

## Statistics
- Total Recordings: ${stats.totalRecordings}
- Total Duration: ${Math.round(stats.totalDuration)} seconds
- Language Breakdown:
${languageStats}

## Directory Structure
- \`/audio\`: Contains all WAV files. Filenames correspond to the \`recording_id\` in the metadata.
- \`metadata.csv\`: Contains the transcripts, speaker IDs, emotion labels, and duration for each recording.

## Metadata Dictionary
- \`recording_id\`: Unique identifier for the audio file (matches the filename in \`/audio\`).
- \`sentence_id\`: Unique identifier for the source text.
- \`sentence_text\`: The spoken transcript.
- \`language_code\`: Language code (e.g., en, te, hi).
- \`emotion\`: The target emotion recorded.
- \`speaker_id\`: Unique identifier for the speaker.
- \`gender\`: Declared gender of the speaker.
- \`duration_seconds\`: Length of the audio file in seconds.
`;
}
