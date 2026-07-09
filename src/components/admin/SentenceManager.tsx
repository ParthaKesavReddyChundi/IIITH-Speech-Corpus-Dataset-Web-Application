"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Upload, FileText, CheckCircle2, Loader2 } from "lucide-react";

export function SentenceManager({ languages }: { languages: { id: string; name: string; code: string }[] }) {
  const router = useRouter();
  const [selectedLang, setSelectedLang] = useState<string>(languages[0]?.id || "");
  const [inputText, setInputText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setInputText(text);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!selectedLang) {
      setStatus({ type: "error", message: "Please select a language." });
      return;
    }

    const rawSentences = inputText.split(/\r?\n/);
    // Rough client-side filter
    const sentences = rawSentences.map(s => s.trim()).filter(s => s.length > 0);

    if (sentences.length === 0) {
      setStatus({ type: "error", message: "No valid sentences found to import." });
      return;
    }

    try {
      setIsUploading(true);
      setStatus({ type: null, message: "" });

      const res = await fetch("/api/admin/sentences/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          languageId: selectedLang,
          sentences,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to import sentences");
      }

      setStatus({ type: "success", message: data.message });
      setInputText(""); // Clear input on success
      router.refresh();

    } catch (error: any) {
      setStatus({ type: "error", message: error.message || "An unknown error occurred." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="bg-card shadow-sm border-border">
      <CardHeader>
        <CardTitle>Import Sentences</CardTitle>
        <CardDescription>
          Upload a CSV/text file or paste sentences directly. One sentence per line.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Target Language</label>
          <select 
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="flex h-10 w-full md:w-64 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {languages.map(lang => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" className="relative cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              Upload .txt / .csv
              <input 
                type="file" 
                accept=".txt,.csv" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileUpload}
              />
            </Button>
            <span className="text-sm text-muted-foreground">or paste below</span>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="e.g. The quick brown fox jumps over the lazy dog."
            className="w-full h-64 min-h-[150px] p-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="text-xs text-muted-foreground">
            {inputText.split(/\r?\n/).filter(s => s.trim().length > 0).length} valid sentence(s) detected.
          </div>
        </div>

        {status.message && (
          <Alert variant={status.type === "error" ? "destructive" : "default"} className={status.type === "success" ? "border-success text-success bg-success/10" : ""}>
            {status.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <AlertTitle>{status.type === "error" ? "Error" : "Success"}</AlertTitle>
            <AlertDescription>{status.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={handleImport} disabled={isUploading || inputText.trim().length === 0} size="lg">
            {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {!isUploading && <FileText className="w-4 h-4 mr-2" />}
            Import Sentences
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}
