import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecordingsTable } from "@/components/admin/RecordingsTable";

export default async function AdminRecordingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; lang?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { page = "1", status = "all", lang = "all" } = await searchParams;
  const pageNum = parseInt(page) || 1;
  const pageSize = 20;
  const offset = (pageNum - 1) * pageSize;

  // Build query
  let query = supabase
    .from("recordings")
    .select(`
      id,
      status,
      created_at,
      duration_seconds,
      sample_number,
      audio_path,
      sentences ( id, text, sentence_number ),
      speakers ( id, users ( name ) ),
      languages ( id, name, code ),
      emotions ( id, name )
    `, { count: "exact" });

  if (status !== "all") {
    query = query.eq("status", status);
  } else {
    query = query.neq("status", "deleted"); // Hide deleted by default unless specifically asked
  }

  if (lang !== "all") {
    query = query.eq("language_id", lang);
  }

  // Execute query
  const { data: recordings, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error("Failed to fetch recordings:", error);
  }

  // Generate signed URLs for audio playback
  const recordingsWithUrls = await Promise.all((recordings || []).map(async (r: any) => {
    let audioUrl = null;
    if (r.audio_path && (r.status === "verified" || r.status === "uploaded")) {
      const { data } = await supabase.storage.from("recordings").createSignedUrl(r.audio_path, 60 * 60); // 1 hr
      audioUrl = data?.signedUrl || null;
    }
    return { ...r, audioUrl };
  }));

  // Fetch filters data
  const { data: languages } = await supabase.from("languages").select("id, name");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recording Review</h1>
        <p className="text-muted-foreground">
          Quality assurance, playback, and status management.
        </p>
      </div>

      <RecordingsTable 
        recordings={recordingsWithUrls} 
        totalCount={count || 0}
        currentPage={pageNum}
        pageSize={pageSize}
        currentStatus={status}
        currentLang={lang}
        languages={languages || []}
      />
    </div>
  );
}
