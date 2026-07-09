"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2, HardDrive, FileArchive } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ExportPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);
      setProgress(0);

      // Start the export stream
      const res = await fetch("/api/admin/export", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to initialize export");
      }

      if (!res.body) {
        throw new Error("ReadableStream not supported in this browser");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let zipUrl = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.status === "progress") {
              setProgress(data.progress);
            } else if (data.status === "complete") {
              zipUrl = data.url;
              setProgress(100);
            } else if (data.status === "error") {
              throw new Error(data.message);
            }
          } catch (e) {
            // Ignore parse errors from chunking
          }
        }
      }

      if (zipUrl) {
        // Trigger download
        const a = document.createElement("a");
        a.href = zipUrl;
        a.download = `iiith-speech-corpus-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        throw new Error("Export completed but no download URL was returned.");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during export.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dataset Export</h1>
        <p className="text-muted-foreground">
          Package and download all verified audio files and metadata.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-card shadow-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileArchive className="w-5 h-5 text-accent" />
              Generate ZIP Package
            </CardTitle>
            <CardDescription>
              Compiles all <strong>Verified</strong> recordings across all languages into a single downloadable archive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>The export package will contain:</p>
              <ul className="list-disc list-inside ml-2">
                <li><code>audio/</code> folder with 16kHz WAV files.</li>
                <li><code>metadata.csv</code> containing sentence texts, language, emotion, and gender.</li>
                <li><code>README.md</code> with corpus statistics and data dictionary.</li>
              </ul>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Export Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isExporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Generating package...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <Button 
              onClick={handleExport} 
              disabled={isExporting} 
              className="w-full"
              size="lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Start Export
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-muted-foreground" />
              Storage Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Large exports can take several minutes to compile. The system streams the files directly from the storage bucket, builds the archive in memory (or temp storage), and provides a signed download link.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
