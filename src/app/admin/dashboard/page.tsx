import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Users, Mic, List, CheckCircle2, AlertTriangle } from "lucide-react";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch quick stats
  const [
    { count: usersCount },
    { count: sentencesCount },
    { count: recordingsCount },
    { count: verifiedCount },
    { count: failedCount }
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("sentences").select("*", { count: "exact", head: true }),
    supabase.from("recordings").select("*", { count: "exact", head: true }),
    supabase.from("recordings").select("*", { count: "exact", head: true }).eq("status", "verified"),
    supabase.from("recordings").select("*", { count: "exact", head: true }).in("status", ["failed", "flagged_for_rerecord"])
  ]);

  const { data: languagesData } = await supabase.from("languages").select("id, name, code");
  const languages = languagesData as any[];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System overview and high-level corpus collection statistics.
        </p>
      </div>

      {/* Top Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={usersCount || 0}
          icon={<Users className="w-5 h-5" />}
          description="Registered platform users"
        />
        <StatCard
          title="Total Sentences"
          value={sentencesCount || 0}
          icon={<List className="w-5 h-5" />}
          description="Across all languages"
        />
        <StatCard
          title="Total Recordings"
          value={recordingsCount || 0}
          icon={<Mic className="w-5 h-5" />}
          description="All takes including drafts"
        />
        <StatCard
          title="Verified Audio"
          value={verifiedCount || 0}
          icon={<CheckCircle2 className="w-5 h-5" />}
          description="Ready for dataset export"
        />
      </div>

      {/* Languages Overview */}
      <h2 className="text-2xl font-semibold mt-8 mb-4">Language Breakdown</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {languages?.map((lang) => (
          <LanguageStatCard key={lang.id} languageId={lang.id} name={lang.name} />
        ))}
      </div>
    </div>
  );
}

// A helper Server Component to fetch specific language stats without blocking the whole page
async function LanguageStatCard({ languageId, name }: { languageId: string; name: string }) {
  const supabase = await createClient();
  
  const [
    { count: sentences },
    { count: verified }
  ] = await Promise.all([
    supabase.from("sentences").select("*", { count: "exact", head: true }).eq("language_id", languageId).eq("is_active", true),
    supabase.from("recordings").select("*", { count: "exact", head: true }).eq("language_id", languageId).eq("status", "verified")
  ]);

  return (
    <Card className="bg-card shadow-sm border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl gradient-accent-text">{name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Active Sentences</span>
            <span className="font-semibold">{sentences || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Verified Recordings</span>
            <span className="font-semibold text-success">{verified || 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
