"use client";

import { useEffect, useRef } from "react";

interface WaveformProps {
  analyser: AnalyserNode | null;
  isRecording: boolean;
}

export function Waveform({ analyser, isRecording }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) {
        // Draw a flat line when not recording
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "hsl(222, 30%, 22%)"; // border color
        ctx.fillRect(0, canvas.height / 2 - 1, canvas.width, 2);
        return;
      }

      requestRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "hsl(245, 82%, 67%)"; // primary accent

      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();

    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, [analyser, isRecording]);

  return (
    <div className="w-full h-24 rounded-lg bg-card border border-border overflow-hidden relative shadow-inner">
      <canvas
        ref={canvasRef}
        width={400}
        height={96}
        className="w-full h-full block"
      />
      {!isRecording && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
          <span className="text-sm font-tech text-muted-foreground uppercase tracking-widest font-semibold">Ready to record</span>
        </div>
      )}
    </div>
  );
}
