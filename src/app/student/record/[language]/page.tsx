import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RecordingInterface } from "@/components/recording/RecordingInterface";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

interface RecordPageProps {
  params: Promise<{ language: string }>;
}

export default async function RecordPage({ params }: RecordPageProps) {
  const { language } = await params;
  const supabase = await createClient();

  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Resolve language code to UUID and name
  const langResult = await supabase
    .from("languages")
    .select("id, name")
    .eq("code", language)
    .single();
  const langRecord = langResult.data as { id: string; name: string } | null;

  if (!langRecord) {
    redirect("/student/dashboard");
  }

  // 3. Get speaker profile for this user
  const userResult = await supabase.from("users").select("id").eq("auth_uid", user.id).single();
  const userId = (userResult.data as { id: string } | null)?.id || "";

  const speakerResult = await supabase
    .from("speakers")
    .select("id, gender_default")
    .eq("user_id", userId)
    .single();
  const speaker = speakerResult.data as { id: string; gender_default: "male" | "female" | "other" | null } | null;

  if (!speaker) {
    redirect("/student/dashboard");
  }

  // 4. Fetch emotions for the selector
  const emotionsResult = await supabase
    .from("emotions")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const emotions = emotionsResult.data as { id: string; name: string }[] | null;

  // 5. Get the next unrecorded sentence via RPC
  const nextSentenceResult = await supabase
    .rpc("get_next_sentence", { 
      p_speaker_id: speaker.id, 
      p_language_id: langRecord.id 
    } as any)
    .single();
  const nextSentenceData = nextSentenceResult.data as { sentence_id: string; text: string; sentence_number: number; movie_name: string | null } | null;
  const nextSentence = nextSentenceData ? { id: nextSentenceData.sentence_id, text: nextSentenceData.text, sentence_number: nextSentenceData.sentence_number, movie_name: nextSentenceData.movie_name } : null;
  return (
    <div className="container-app py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/student/dashboard" className={buttonVariants({ variant: "ghost", size: "sm", className: "mb-2 -ml-3 text-muted-foreground hover:text-foreground" })}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold">
            Recording <span className="gradient-accent-text">{langRecord.name}</span>
          </h1>
        </div>
        
        {nextSentence && (
          <div className="bg-secondary px-3 py-1.5 rounded-full text-sm font-medium border border-border">
            Sentence {nextSentence.sentence_number}
          </div>
        )}
      </div>

      {!nextSentence ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-3xl font-bold">All done!</h2>
          <p className="text-muted-foreground text-lg">
            You have completed all active {langRecord.name} sentences. Great job!
          </p>
          <Link href="/student/dashboard" className={buttonVariants({ size: "lg", className: "mt-4" })}>
            Return to Dashboard
          </Link>
        </div>
      ) : (
        <RecordingInterface
          key={nextSentence.id}
          sentence={nextSentence}
          languageCode={language}
          languageId={langRecord.id}
          speakerId={speaker.id}
          defaultGender={speaker.gender_default || undefined}
          emotions={emotions || []}
          onUploadComplete={async () => {
            "use server"; // Server action to revalidate and refresh the page to get the next sentence
            // Since we're in a Server Component context passing a function down to a Client Component,
            // we can use a server action. However, doing so requires Next.js 14+ specific setup.
            // A simpler approach for the client is to use router.refresh(). 
            // We'll handle the refresh inside a client wrapper or we just don't pass a server action,
            // but rely on window.location.reload() or router.refresh() from the client side.
            // Wait, passing a server action here is valid in Next.js App Router.
            import("next/cache").then(m => m.revalidatePath(`/student/record/${language}`));
          }}
        />
      )}
    </div>
  );
}
