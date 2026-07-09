"use client";

import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { AudioRecorder } from "@/lib/audio/recorder";
import { Waveform } from "./Waveform";
import { RecordButton } from "./RecordButton";
import { PlaybackControls } from "./PlaybackControls";
import { GenderSelector } from "./GenderSelector";
import { EmotionSelector } from "./EmotionSelector";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Mic, Square, Play, RotateCcw, Check, AlertCircle, Loader2, CheckCircle2, Send } from "lucide-react";
import { convertToWav } from "@/lib/audio/wavConverter";
import { computeChecksum } from "@/lib/audio/checksum";
import { saveTakeToIndexedDB, removeTakeFromIndexedDB } from "@/lib/audio/indexedDbBuffer";
import type { RecordingUiState, RecordingSession } from "@/types";

interface Emotion {
  id: string;
  name: string;
}

interface RecordingInterfaceProps {
  sentence: {
    id: string;
    text: string;
    sentence_number: number;
  };
  languageCode: string;
  languageId: string;
  speakerId: string;
  defaultGender?: "male" | "female" | "other";
  emotions: Emotion[];
  onUploadComplete: () => void;
}

export function RecordingInterface({
  sentence,
  languageCode,
  languageId,
  speakerId,
  defaultGender,
  emotions,
  onUploadComplete,
}: RecordingInterfaceProps) {
  // State
  const [session, setSession] = useState<RecordingSession>({
    clientUploadId: uuidv4(),
    rawBlob: null,
    wavBlob: null,
    checksumSha256: null,
    durationSeconds: null,
    state: "idle",
    errorMessage: null,
    hasPlayedBack: false,
  });

  const [gender, setGender] = useState<"male" | "female" | "other" | "">(
    defaultGender || ""
  );
  const [emotionId, setEmotionId] = useState<string>("");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // Refs
  const recorderRef = useRef<AudioRecorder | null>(null);

  // Initialize recorder on mount
  useEffect(() => {
    recorderRef.current = new AudioRecorder();
    return () => {
      recorderRef.current?.cleanup();
    };
  }, []);

  // Before unload warning if recording or uploading
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (session.state === "recording" || session.state === "uploading" || session.state === "converting") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [session.state]);

  const updateSession = (updates: Partial<RecordingSession>) => {
    setSession((prev) => ({ ...prev, ...updates }));
  };

  const handleStartRecording = async () => {
    try {
      if (!recorderRef.current) return;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        updateSession({
          state: "error",
          errorMessage: "Audio recording is not supported in this browser. Please ensure you are using a modern browser and are on a secure (HTTPS) connection.",
        });
        return;
      }

      // Request permissions and get analyser node
      if (!analyser) {
        const newAnalyser = await recorderRef.current.initialize();
        setAnalyser(newAnalyser);
      }

      recorderRef.current.start();
      updateSession({
        state: "recording",
        errorMessage: null,
        rawBlob: null,
        hasPlayedBack: false,
      });
    } catch (err) {
      updateSession({
        state: "error",
        errorMessage: "Microphone access denied or unavailable. Please check your browser settings.",
      });
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current || session.state !== "recording") return;

    try {
      const { blob, durationSeconds, isSilent } = await recorderRef.current.stop();

      // Duration limits check (configured in env, defaulting to 0.5s - 15s)
      const minDuration = Number(process.env.NEXT_PUBLIC_MIN_RECORDING_DURATION_S || 0.5);
      const maxDuration = Number(process.env.NEXT_PUBLIC_MAX_RECORDING_DURATION_S || 15);

      if (durationSeconds < minDuration) {
        updateSession({
          state: "error",
          errorMessage: `Recording too short. Please speak clearly for at least ${minDuration} seconds.`,
        });
        return;
      }

      if (durationSeconds > maxDuration) {
        updateSession({
          state: "error",
          errorMessage: `Recording too long. Maximum allowed is ${maxDuration} seconds.`,
        });
        return;
      }

      if (isSilent) {
        updateSession({
          state: "error",
          errorMessage: "No audio detected. Please check your microphone and try again.",
        });
        return;
      }

      updateSession({
        state: "stopped",
        rawBlob: blob,
        durationSeconds,
      });
      
      // We will skip WAV conversion for now to test the UI flow quickly.
      // In Phase 5, this will trigger the FFmpeg.wasm conversion.
      // For now, let's pretend rawBlob is ready to be uploaded (or converted).
      // We'll set it as converted directly for the sake of Phase 4 UI.
      updateSession({ state: "converted", wavBlob: blob });

    } catch (err) {
      updateSession({
        state: "error",
        errorMessage: "Failed to stop recording.",
      });
    }
  };

  const handleRerecord = () => {
    updateSession({
      state: "idle",
      rawBlob: null,
      wavBlob: null,
      hasPlayedBack: false,
      clientUploadId: uuidv4(), // generate new ID for the new attempt
    });
  };

  const handleSubmit = async () => {
    if (!session.wavBlob || !gender || !emotionId || !sentence.id || !speakerId || !languageId) return;

    try {
      updateSession({ state: "converting" });
      
      // 1. Convert to WAV
      const wavBlob = await convertToWav(session.wavBlob);
      
      // 2. Generate ID & Checksum
      const clientUploadId = uuidv4();
      const checksum = await computeChecksum(wavBlob);
      const timestamp = Date.now();
      
      const metadata = {
        clientUploadId,
        sentenceId: sentence.id,
        speakerId,
        languageId,
        emotionId,
        gender,
        durationSeconds: session.durationSeconds || 0,
        checksum,
      };

      // 3. Save to IndexedDB (Reliability Layer)
      await saveTakeToIndexedDB({
        ...metadata,
        sampleNumber: 1, // Will be overridden by server RPC
        blob: wavBlob,
        timestamp
      });
      
      updateSession({ state: "uploading" });

      // 4. Create FormData for API Route
      const formData = new FormData();
      formData.append("file", wavBlob, `${clientUploadId}.wav`);
      formData.append("metadata", JSON.stringify(metadata));

      // 5. Upload via API Route
      const response = await fetch("/api/recordings/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      
      if (result.status === "failed") {
        throw new Error("Verification failed: checksum mismatch.");
      }

      // 6. Cleanup local storage on success
      await removeTakeFromIndexedDB(clientUploadId);

      updateSession({ state: "verified" });
      
      // 7. Complete and advance sentence
      setTimeout(async () => {
        try {
          await onUploadComplete();
        } catch (e) {
          console.error(e);
        }
        window.location.reload();
      }, 1000);

    } catch (err) {
      console.error("Upload failed", err);
      updateSession({ state: "stopped" });
      alert("Upload failed! But don't worry, your recording has been securely saved locally to your browser. You can safely refresh the page or try uploading again.");
    }
  };

  // Derived state
  const isReadyToRecord = gender !== "" && emotionId !== "";
  const isRecordingDisabled = !isReadyToRecord || session.state === "uploading" || session.state === "verified";
  
  // Font class for the sentence based on language
  const fontClass = languageCode === "te" ? "lang-te" : languageCode === "hi" ? "lang-hi" : "lang-en";

  if (session.state === "verified") {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 animate-fade-in text-center space-y-4 bg-success/5 border border-success/20 rounded-xl">
        <CheckCircle2 className="w-16 h-16 text-success animate-bounce" />
        <h3 className="text-2xl font-bold text-success">Recording Verified!</h3>
        <p className="text-muted-foreground">Moving to the next sentence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
      {/* Top Section: Sentence */}
      <div className="p-8 rounded-2xl bg-card border border-border shadow-sm text-center min-h-[160px] flex items-center justify-center">
        <p className={`text-3xl md:text-4xl font-semibold leading-tight ${fontClass}`}>
          {sentence.text}
        </p>
      </div>

      {/* Middle Section: Metadata selectors (disabled during recording/uploading) */}
      <div className="grid md:grid-cols-2 gap-6 p-6 rounded-xl bg-card/40 border border-border/50">
        <GenderSelector 
          value={gender} 
          onChange={(v) => setGender(v)} 
          disabled={session.state !== "idle" && session.state !== "error"} 
        />
        <EmotionSelector 
          emotions={emotions} 
          value={emotionId} 
          onChange={setEmotionId} 
          disabled={session.state !== "idle" && session.state !== "error"} 
        />
      </div>

      {!isReadyToRecord && session.state === "idle" && (
        <Alert className="border-info/50 bg-info/10 text-info">
          <AlertCircle className="h-4 w-4 text-info" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            Please select a voice gender and an emotion to enable recording.
          </AlertDescription>
        </Alert>
      )}

      {session.errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Recording Error</AlertTitle>
          <AlertDescription>{session.errorMessage}</AlertDescription>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={handleRerecord}>
              Try Again
            </Button>
          </div>
        </Alert>
      )}

      {/* Bottom Section: Recording & Playback */}
      <div className="space-y-6">
        <Waveform analyser={analyser} isRecording={session.state === "recording"} />
        
        {session.state === "idle" || session.state === "recording" ? (
          <div className="flex justify-center py-4">
            <RecordButton 
              isRecording={session.state === "recording"} 
              onClick={session.state === "recording" ? handleStopRecording : handleStartRecording} 
              disabled={isRecordingDisabled}
            />
          </div>
        ) : null}

        {(session.state === "converted" || session.state === "stopped") && session.wavBlob && (
          <PlaybackControls 
            audioBlob={session.wavBlob}
            onPlaybackComplete={() => updateSession({ hasPlayedBack: true })}
            onRerecord={handleRerecord}
          />
        )}

        {session.state === "converting" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="font-medium">Converting audio to WAV...</p>
          </div>
        )}

        {session.state === "uploading" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="font-medium">Uploading and verifying...</p>
          </div>
        )}

        {(session.state === "converted" || session.state === "stopped") && (
          <div className="flex justify-end pt-4 border-t border-border mt-4">
            <Button
              className="w-full md:w-auto btn-primary"
              size="lg"
              onClick={handleSubmit}
              disabled={!session.hasPlayedBack || !emotionId || !gender}
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Recording
            </Button>
          </div>
        )}
        
        {(session.state === "converted" || session.state === "stopped") && !session.hasPlayedBack && (
          <p className="text-sm text-center text-muted-foreground mt-2">
            You must play back the recording completely before submitting.
          </p>
        )}
      </div>
    </div>
  );
}
