/**
 * WAV Converter using native Web Audio API (OfflineAudioContext).
 * Converts any browser-recorded format (WebM/Opus or MP4/AAC) into 
 * standard PCM WAV (16kHz, mono, 16-bit) WITHOUT needing ffmpeg.wasm.
 */

export async function convertToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Decode the raw recording (WebM/mp4) into an AudioBuffer
  const decodedData = await audioContext.decodeAudioData(arrayBuffer);

  // Define target specs: 16kHz, mono
  const targetSampleRate = 16000;
  const numChannels = 1;
  const offlineContext = new OfflineAudioContext(
    numChannels,
    (decodedData.length * targetSampleRate) / decodedData.sampleRate,
    targetSampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = decodedData;
  source.connect(offlineContext.destination);
  source.start(0);

  // Render the audio into a 16kHz mono buffer
  const renderedBuffer = await offlineContext.startRendering();

  // Convert the buffer to a 16-bit PCM WAV Blob
  return bufferToWav(renderedBuffer);
}

function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let offset = 0;
  let pos = 0;

  // Write WAV Header
  writeString(view, offset, 'RIFF'); offset += 4;
  view.setUint32(offset, length - 8, true); offset += 4;
  writeString(view, offset, 'WAVE'); offset += 4;
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size (16 for PCM)
  view.setUint16(offset, 1, true); offset += 2; // AudioFormat (1 for PCM)
  view.setUint16(offset, numOfChan, true); offset += 2;
  view.setUint32(offset, buffer.sampleRate, true); offset += 4;
  view.setUint32(offset, buffer.sampleRate * 2 * numOfChan, true); offset += 4; // ByteRate
  view.setUint16(offset, numOfChan * 2, true); offset += 2; // BlockAlign
  view.setUint16(offset, 16, true); offset += 2; // BitsPerSample
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, length - offset - 4, true); offset += 4;

  // Write Interleaved PCM Data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      // clip
      let sample = Math.max(-1, Math.min(1, channels[i][pos]));
      // 16-bit conversion
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
