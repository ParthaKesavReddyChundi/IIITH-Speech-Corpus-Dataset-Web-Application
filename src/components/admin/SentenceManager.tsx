"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Upload, FileText, CheckCircle2, Loader2, Trash2 } from "lucide-react";

export function SentenceManager({ languages }: { languages: { id: string; name: string; code: string }[] }) {
  const router = useRouter();
  const [selectedLang, setSelectedLang] = useState<string>(languages[0]?.id || "");
  const [inputText, setInputText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [importMode, setImportMode] = useState<"single" | "multi">("single");
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (importMode === "multi") {
      handleMultiImport(file);
      return;
    }

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

  const handleMultiImport = async (file: File) => {
    try {
      setIsUploading(true);
      setStatus({ type: null, message: "" });

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/sentences/import-multi", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process Excel file");

      setStatus({ type: "success", message: data.message });
      router.refresh();
    } catch (error: any) {
      setStatus({ type: "error", message: error.message || "An unknown error occurred." });
    } finally {
      setIsUploading(false);
      // reset file input if needed
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("DANGER: Are you sure you want to delete ALL sentences? This will also delete ALL recordings in the database! This action cannot be undone.")) return;

    try {
      setIsDeleting(true);
      setStatus({ type: null, message: "" });

      const res = await fetch("/api/admin/sentences/delete-all", { method: "POST" });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to delete sentences");

      setStatus({ type: "success", message: data.message });
      router.refresh();
    } catch (error: any) {
      setStatus({ type: "error", message: error.message || "An unknown error occurred." });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card shadow-sm border-border">
        <CardHeader>
        <CardTitle>Import Sentences</CardTitle>
        <CardDescription>
          Upload an Excel grid to auto-detect languages, or paste raw text for a specific language.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="flex gap-4 border-b border-border pb-2">
          <button 
            className={`text-sm font-medium pb-2 ${importMode === "single" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
            onClick={() => setImportMode("single")}
          >
            Raw Text Paste
          </button>
          <button 
            className={`text-sm font-medium pb-2 ${importMode === "multi" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
            onClick={() => setImportMode("multi")}
          >
            Smart Excel Import
          </button>
        </div>

        {importMode === "single" && (
          <div className="space-y-6">
        
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
        </div>
        )}

        {importMode === "multi" && (
          <div className="space-y-6 py-6 text-center border-2 border-dashed border-border rounded-lg bg-muted/20">
            <div className="flex flex-col items-center justify-center space-y-3">
              <Upload className="w-10 h-10 text-muted-foreground" />
              <h3 className="text-lg font-medium">Upload Master Excel (.xlsx)</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Upload your master spreadsheet. The system will auto-detect "Telugu", "Hindi", and "English" columns and route the transcripts perfectly.
              </p>
              <div className="mt-4 relative cursor-pointer">
                <Button disabled={isUploading}>
                  {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Select .xlsx File
                </Button>
                <input 
                  type="file" 
                  accept=".xlsx" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </div>
            </div>
          </div>
        )}

      </CardContent>
    </Card>

    <Card className="bg-destructive/5 border-destructive/20 shadow-sm">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>
          Permanently remove all transcripts and their associated recordings from the database.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          variant="destructive" 
          onClick={handleDeleteAll} 
          disabled={isDeleting || isUploading}
        >
          {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
          Delete All Transcripts & Recordings
        </Button>
      </CardContent>
    </Card>
    </div>
  );
}
