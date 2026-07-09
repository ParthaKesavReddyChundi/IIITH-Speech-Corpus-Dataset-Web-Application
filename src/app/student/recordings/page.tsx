import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MyRecordingsTable } from "@/components/student/MyRecordingsTable";

export default async function MyRecordingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; lang?: string }>;
}) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Get speaker ID
  const speakerResult = await supabase
    .from("speakers")
    .select("id")
    .eq("user_id", ((await supabase.from("users").select("id").eq("auth_uid", user.id).single()).data as any)?.id)
    .single();
    
  if (!speakerResult.data) {
    redirect("/student/dashboard");
  }

  const { page = "1", status = "all", lang = "all" } = await searchParams;
  const pageNum = parseInt(page) || 1;
  const pageSize = 15;
  const offset = (pageNum - 1) * pageSize;

  let query = supabase
    .from("recordings")
    .select(`
      id,
      status,
      created_at,
      duration_seconds,
      audio_path,
      sentences ( text, sentence_number ),
      languages ( id, name, code ),
      emotions ( name )
    `, { count: "exact" })
    .neq("status", "deleted") // Don't show deleted ones to the student
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (lang !== "all") {
    query = query.eq("language_id", lang);
  }

  const { data: recordings, count, error } = await query.range(offset, offset + pageSize - 1);

  if (error) {
    console.error("Failed to fetch my recordings:", error);
  }

  // Generate signed URLs for audio playback
  const recordingsWithUrls = await Promise.all((recordings || []).map(async (r: any) => {
    let audioUrl = null;
    if (r.audio_path && (r.status === "verified" || r.status === "uploaded" || r.status === "flagged_for_rerecord")) {
      const { data } = await supabase.storage.from("recordings").createSignedUrl(r.audio_path, 60 * 60);
      audioUrl = data?.signedUrl || null;
    }
    return { ...r, audioUrl };
  }));

  const { data: languages } = await supabase.from("languages").select("id, name");

  return (
    <div className="container-app max-w-5xl mx-auto py-16 md:py-24 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Recordings</h1>
        <p className="text-muted-foreground">
          View, listen, and manage your submitted recordings.
        </p>
      </div>

      <MyRecordingsTable 
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
