import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/dashboard/progress-bar";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Mic, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function StudentDashboard() {
  const supabase = await createClient();
  
  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Get speaker profile for this user
  const userResult = await supabase.from("users").select("id, name").eq("auth_uid", user.id).single();
  const userId = (userResult.data as { id: string } | null)?.id || "";
  const userName = (userResult.data as { name: string } | null)?.name || "there";

  const speakerResult = await supabase
    .from("speakers")
    .select("id")
    .eq("user_id", userId)
    .single();
    
  const speaker = speakerResult.data as { id: string } | null;

  if (!speaker) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-10">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Profile Missing</AlertTitle>
          <AlertDescription>
            Your speaker profile has not been set up. Please contact the administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // 3. Get progress data via RPC
  const progressResult = await supabase
    .rpc("get_dashboard_progress", { p_speaker_id: speaker.id } as any);
    
  const progressData = progressResult.data as {
    language_code: string;
    language_name: string;
    total_sentences: number;
    completed: number;
    flagged: number;
  }[] | null;
  
  const progressError = progressResult.error;

  if (progressError) {
    console.error("Error fetching progress:", progressError);
  }

  const languages = progressData || [];
  
  // Calculate overall progress
  const totalSentences = languages.reduce((acc, curr) => acc + Number(curr.total_sentences || 0), 0);
  const totalCompleted = languages.reduce((acc, curr) => acc + Number(curr.completed || 0), 0);
  const totalFlagged = languages.reduce((acc, curr) => acc + Number(curr.flagged || 0), 0);
  
  const overallPercentage = totalSentences > 0 ? (totalCompleted / totalSentences) * 100 : 0;

  return (
    <div className="container-app max-w-5xl mx-auto py-16 md:py-24 space-y-10 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Welcome back, <span className="gradient-accent-text">{userName}</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Here is your recording progress across all languages.
          </p>
        </div>
        <ThemeToggle />
      </div>

      {totalFlagged > 0 && (
        <Alert className="border-warning/50 bg-warning/10 text-warning">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <AlertTitle className="text-warning-foreground font-semibold">Recordings Flagged</AlertTitle>
          <AlertDescription className="text-warning-foreground/90">
            You have {totalFlagged} recording(s) flagged for re-recording by the admin. 
            They will appear when you start recording the respective language.
          </AlertDescription>
        </Alert>
      )}

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard 
          title="Overall Progress" 
          value={`${Math.round(overallPercentage)}%`}
          description={`${totalCompleted} of ${totalSentences} completed`}
          className="bg-card/40"
        />
        <StatCard 
          title="Total Completed" 
          value={totalCompleted}
          icon={<CheckCircle2 className="h-5 w-5 text-success" />}
          className="bg-card/40"
        />
        <StatCard 
          title="Remaining" 
          value={totalSentences - totalCompleted}
          className="bg-card/40"
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Languages</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 stagger-children">
          {languages.map((lang) => {
            const total = Number(lang.total_sentences || 0);
            const completed = Number(lang.completed || 0);
            const percentage = total > 0 ? (completed / total) * 100 : 0;
            const isFinished = total > 0 && completed >= total;

            return (
              <Card key={lang.language_code} className="card overflow-hidden flex flex-col h-full">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-center mb-1">
                    <CardTitle className="text-xl">{lang.language_name}</CardTitle>
                    {isFinished && <CheckCircle2 className="h-5 w-5 text-success" />}
                  </div>
                  <CardDescription>
                    {completed} / {total} sentences
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="mb-6">
                    <ProgressBar 
                      percentage={percentage} 
                      barClassName={isFinished ? "bg-success" : undefined}
                    />
                  </div>
                  
                  <Link 
                    href={`/student/record/${lang.language_code}`}
                    className={buttonVariants({ 
                      variant: isFinished ? "secondary" : "default", 
                      className: "w-full mt-auto" 
                    })}
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    {isFinished ? "Review / Re-record" : (completed > 0 ? "Continue Recording" : "Start Recording")}
                  </Link>
                </CardContent>
              </Card>
            );
          })}
          
          {languages.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg">
              No languages have been set up yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
