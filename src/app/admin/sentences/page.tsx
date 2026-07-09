import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SentenceManager } from "@/components/admin/SentenceManager";

export default async function AdminSentencesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch languages
  const { data: languagesData } = await supabase.from("languages").select("id, name, code").order("name");
  const languages = languagesData as any[];

  // Fetch some stats to display below the manager
  const { data: sentenceStats } = await supabase
    .from("sentences")
    .select("language_id")
    .eq("is_active", true);

  const statsMap = ((sentenceStats as any[]) || []).reduce((acc, curr) => {
    acc[curr.language_id] = (acc[curr.language_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sentence Management</h1>
        <p className="text-muted-foreground">
          Upload and manage the text corpus for each language.
        </p>
      </div>

      <SentenceManager languages={languages || []} />

      <div>
        <h2 className="text-xl font-semibold mb-4">Current Corpus Size</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {languages?.map((lang) => (
            <div key={lang.id} className="p-4 rounded-lg bg-card border border-border flex justify-between items-center shadow-sm">
              <span className="font-medium">{lang.name}</span>
              <span className="text-2xl font-bold gradient-accent-text">{statsMap[lang.id] || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
