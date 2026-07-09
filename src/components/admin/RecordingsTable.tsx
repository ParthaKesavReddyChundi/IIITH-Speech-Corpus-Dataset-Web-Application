"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, AlertTriangle, Trash2, CheckCircle2 } from "lucide-react";
import { flagRecording, deleteRecording } from "@/app/admin/recordings/actions";

export function RecordingsTable({
  recordings,
  totalCount,
  currentPage,
  pageSize,
  currentStatus,
  currentLang,
  languages,
}: {
  recordings: any[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  currentStatus: string;
  currentLang: string;
  languages: any[];
}) {
  const router = useRouter();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    params.set("page", "1"); // Reset to page 1 on filter change
    router.push(`?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", newPage.toString());
    router.push(`?${params.toString()}`);
  };

  const playAudio = (url: string, id: string) => {
    if (audioRef) {
      audioRef.pause();
    }
    const audio = new Audio(url);
    audio.play();
    setPlayingId(id);
    setAudioRef(audio);

    audio.onended = () => {
      setPlayingId(null);
    };
  };

  const pauseAudio = () => {
    if (audioRef) {
      audioRef.pause();
    }
    setPlayingId(null);
  };

  const handleAction = async (action: "flag" | "delete", id: string) => {
    try {
      if (action === "flag") {
        if (confirm("Flag this recording for re-recording?")) {
          await flagRecording(id);
        }
      } else if (action === "delete") {
        if (confirm("Are you sure you want to delete this recording? It will be marked as deleted.")) {
          await deleteRecording(id);
        }
      }
    } catch (e: any) {
      alert("Action failed: " + e.message);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-4">
        <select 
          value={currentStatus} 
          onChange={(e) => handleFilterChange("status", e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Active Statuses</option>
          <option value="verified">Verified</option>
          <option value="uploaded">Uploaded (Unverified)</option>
          <option value="flagged_for_rerecord">Flagged</option>
          <option value="failed">Failed</option>
          <option value="deleted">Deleted</option>
        </select>

        <select 
          value={currentLang} 
          onChange={(e) => handleFilterChange("lang", e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Languages</option>
          {languages.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sentence</TableHead>
                <TableHead>Speaker</TableHead>
                <TableHead>Audio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordings.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-md">
                    <div className="font-medium truncate" title={r.sentences?.text}>
                      {r.sentences?.text}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {r.languages?.name} • Sentence {r.sentences?.sentence_number} • {r.emotions?.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.speakers?.users?.name}
                  </TableCell>
                  <TableCell>
                    {r.audioUrl ? (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => playingId === r.id ? pauseAudio() : playAudio(r.audioUrl, r.id)}
                      >
                        {playingId === r.id ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        {r.duration_seconds ? `${r.duration_seconds}s` : "Play"}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No audio</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      r.status === "verified" ? "default" :
                      r.status === "flagged_for_rerecord" ? "destructive" :
                      "secondary"
                    }>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleAction("flag", r.id)} title="Flag for re-recording" disabled={r.status === "flagged_for_rerecord" || r.status === "deleted"}>
                        <AlertTriangle className="w-4 h-4 text-warning" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleAction("delete", r.id)} title="Soft delete" disabled={r.status === "deleted"}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {recordings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No recordings found matching criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <Button variant="outline" disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)}>
            Previous
          </Button>
          <span className="text-sm">Page {currentPage} of {totalPages}</span>
          <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => handlePageChange(currentPage + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
