"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, Trash2, Loader2, RefreshCw } from "lucide-react";
import { deleteMyRecording } from "@/app/student/recordings/actions";

interface Recording {
  id: string;
  status: string;
  created_at: string;
  duration_seconds: number;
  audioUrl: string | null;
  sentences: { text: string; sentence_number: number };
  languages: { id: string; name: string; code: string };
  emotions: { name: string };
}

interface MyRecordingsTableProps {
  recordings: Recording[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  currentStatus: string;
  currentLang: string;
  languages: { id: string; name: string }[];
}

export function MyRecordingsTable({
  recordings,
  totalCount,
  currentPage,
  pageSize,
  currentStatus,
  currentLang,
  languages
}: MyRecordingsTableProps) {
  const router = useRouter();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const totalPages = Math.ceil(totalCount / pageSize);

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    if (key !== "page") params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  const handlePlay = (id: string, url: string) => {
    if (playingId === id) {
      audioElement?.pause();
      setPlayingId(null);
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    const audio = new Audio(url);
    audio.onended = () => setPlayingId(null);
    audio.play();
    setAudioElement(audio);
    setPlayingId(id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recording? You will have to re-record this sentence.")) return;
    
    setIsDeleting(id);
    const result = await deleteMyRecording(id);
    setIsDeleting(null);
    
    if (result.success) {
      alert("Recording deleted successfully. The sentence is now available to record again.");
    } else {
      alert(result.error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified": return <Badge className="badge-verified">Verified</Badge>;
      case "uploaded": return <Badge className="badge-uploaded">Pending</Badge>;
      case "failed": return <Badge className="badge-failed">Failed</Badge>;
      case "flagged_for_rerecord": return <Badge className="badge-flagged">Needs Rerecord</Badge>;
      default: return <Badge className="badge-draft">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex gap-2">
          <select 
            className="input max-w-[150px] py-1.5"
            value={currentStatus}
            onChange={(e) => updateFilters("status", e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="verified">Verified</option>
            <option value="uploaded">Pending</option>
            <option value="flagged_for_rerecord">Needs Rerecord</option>
          </select>
          
          <select 
            className="input max-w-[150px] py-1.5"
            value={currentLang}
            onChange={(e) => updateFilters("lang", e.target.value)}
          >
            <option value="all">All Languages</option>
            {languages.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Date</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Transcript</TableHead>
              <TableHead>Emotion</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recordings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No recordings found.
                </TableCell>
              </TableRow>
            ) : (
              recordings.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap font-tech text-xs">
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase font-tech text-[10px] tracking-wider">
                      {r.languages?.code}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className={`line-clamp-2 max-w-[300px] ${r.languages?.code === 'te' ? 'lang-te' : r.languages?.code === 'hi' ? 'lang-hi' : 'lang-en'}`}>
                      {r.sentences?.text}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-secondary/50">
                      {r.emotions?.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-tech text-xs text-muted-foreground">
                    {r.duration_seconds?.toFixed(1)}s
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(r.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.audioUrl && (
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => handlePlay(r.id, r.audioUrl!)}
                          className="h-8 rounded-md px-3 border border-border"
                        >
                          {playingId === r.id ? <Pause className="w-3.5 h-3.5 mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
                          {playingId === r.id ? "Playing" : "Listen"}
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                        onClick={() => handleDelete(r.id)}
                        disabled={isDeleting === r.id}
                        title="Delete and re-record this sentence"
                      >
                        {isDeleting === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => updateFilters("page", (currentPage - 1).toString())}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          <span className="text-sm font-tech px-4">
            Page {currentPage} of {totalPages}
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => updateFilters("page", (currentPage + 1).toString())}
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
