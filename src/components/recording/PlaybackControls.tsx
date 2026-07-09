"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Square, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/dashboard/progress-bar";

interface PlaybackControlsProps {
  audioBlob: Blob | null;
  onPlaybackComplete: () => void;
  onRerecord: () => void;
  disabled?: boolean;
}

export function PlaybackControls({
  audioBlob,
  onPlaybackComplete,
  onRerecord,
  disabled,
}: PlaybackControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setProgress(100);
        onPlaybackComplete();
      });

      audio.addEventListener("timeupdate", () => {
        setProgress((audio.currentTime / audio.duration) * 100);
      });

      return () => {
        audio.pause();
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
    }
  }, [audioBlob, onPlaybackComplete]);

  useEffect(() => {
    const handleToggleEvent = () => togglePlayback();
    window.addEventListener("toggle-playback", handleToggleEvent);
    return () => window.removeEventListener("toggle-playback", handleToggleEvent);
  }, [isPlaying, progress]);

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // If finished, restart
      if (progress >= 100) {
        audioRef.current.currentTime = 0;
      }
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  if (!audioBlob) return null;

  return (
    <div className="space-y-4 p-4 rounded-xl bg-card border border-border mt-4">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="w-12 h-12 rounded-full shrink-0"
          onClick={togglePlayback}
          disabled={disabled}
        >
          {isPlaying ? (
            <Square className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-1" />
          )}
        </Button>
        <div className="flex-1">
          <ProgressBar 
            percentage={progress} 
            showPercentage={false} 
            className="mb-1"
            barClassName="bg-primary"
          />
          <div className="text-xs text-muted-foreground flex justify-between mt-2">
            <span>Playback</span>
            <span>{progress === 100 ? "Finished" : isPlaying ? "Playing..." : "Paused"}</span>
          </div>
        </div>
      </div>
      
      <div className="flex justify-center pt-2 border-t border-border/50">
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          onClick={onRerecord}
          disabled={disabled || isPlaying}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Re-record
        </Button>
      </div>
    </div>
  );
}
