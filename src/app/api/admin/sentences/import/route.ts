import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

const importSchema = z.object({
  languageId: z.string().uuid(),
  sentences: z.array(z.string().min(1).max(2000)),
});

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createServiceClient();
    
    // We use service client to verify admin status
    const authHeader = req.headers.get("Authorization");
    // In App Router, we should normally check the session cookie.
    // Wait, the API route should just use the standard createClient to check who is logged in.
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase.from("users").select("role").eq("auth_uid", user.id).single();
    if ((userData as any)?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { languageId, sentences } = importSchema.parse(body);

    // 1. Normalize and deduplicate incoming sentences
    // Unicode NFC normalization is critical for Indic scripts (Telugu/Hindi)
    const normalizedSentences = Array.from(new Set(
      sentences.map(s => s.trim().normalize("NFC")).filter(s => s.length > 0)
    ));

    if (normalizedSentences.length === 0) {
      return NextResponse.json({ error: "No valid sentences provided" }, { status: 400 });
    }

    // 2. Fetch existing sentences for this language to prevent duplicates and find max sentence_number
    const { data: existingData, error: fetchError } = await supabaseAdmin
      .from("sentences")
      .select("normalized_text, sentence_number")
      .eq("language_id", languageId);

    if (fetchError) throw fetchError;

    const existingTexts = new Set((existingData as any[])?.map((r: any) => r.normalized_text) || []);
    let maxSentenceNumber = (existingData as any[])?.reduce((max: number, r: any) => Math.max(max, r.sentence_number), 0) || 0;

    // 3. Filter out sentences that already exist
    const newSentences = normalizedSentences.filter(s => !existingTexts.has(s));

    if (newSentences.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "No new sentences to import. All provided sentences already exist.",
        importedCount: 0 
      });
    }

    // 4. Prepare batch insert
    const insertPayload = newSentences.map((text) => {
      maxSentenceNumber++;
      return {
        language_id: languageId,
        text: text, // Original text
        normalized_text: text, // Normalized (they are the same here since we normalized the array)
        sentence_number: maxSentenceNumber,
        is_active: true,
      };
    });

    // 5. Insert into DB
    const { error: insertError } = await supabaseAdmin
      .from("sentences")
      .insert(insertPayload as any);

    if (insertError) throw insertError;

    return NextResponse.json({ 
      success: true, 
      importedCount: insertPayload.length,
      message: `Successfully imported ${insertPayload.length} sentences.`
    });

  } catch (error) {
    console.error("Import API Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: (error as any).errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
