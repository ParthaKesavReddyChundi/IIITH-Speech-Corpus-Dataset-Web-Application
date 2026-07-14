import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import * as xlsx from "xlsx";

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createServiceClient();
    
    // Auth Check
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData } = await supabase.from("users").select("role").eq("auth_uid", user.id).single();
    if ((userData as any)?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse XLSX
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // header: 1 returns a 2D array of rows
    const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    // Fetch language IDs
    const { data: languages } = await supabaseAdmin.from("languages").select("id, code");
    const langMap = {
      te: (languages as any[])?.find(l => l.code === "te")?.id,
      en: (languages as any[])?.find(l => l.code === "en")?.id,
      hi: (languages as any[])?.find(l => l.code === "hi")?.id,
    };

    if (!langMap.te || !langMap.en || !langMap.hi) {
      return NextResponse.json({ error: "Languages (te, en, hi) not properly seeded in database" }, { status: 500 });
    }

    let currentMapping: { te: number; en: number; hi: number; movie: number; emotion: number } | null = null;
    
    // We will collect raw sentences into these arrays
    const toInsert: { [langCode: string]: { text: string; movie_name: string | null; intended_emotion: string | null }[] } = {
      te: [],
      en: [],
      hi: []
    };

    for (const row of rows) {
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0] || "").trim().toLowerCase();
      
      if (firstCell === "language" || firstCell === "original language") {
        currentMapping = { te: -1, en: -1, hi: -1, movie: -1, emotion: -1 };
        for (let i = 0; i < row.length; i++) {
          const colName = String(row[i] || "").toLowerCase();
          if (colName.includes("telugu")) currentMapping.te = i;
          if (colName.includes("english")) currentMapping.en = i;
          if (colName.includes("hindi")) currentMapping.hi = i;
          if (colName.includes("movie")) currentMapping.movie = i;
          if (colName.includes("emotion")) currentMapping.emotion = i;
        }
        continue;
      }

      // If we have a mapping and the row has data, extract
      if (currentMapping) {
        const movieName = currentMapping.movie !== -1 && row[currentMapping.movie] 
          ? String(row[currentMapping.movie]).trim() 
          : null;
          
        const intendedEmotion = currentMapping.emotion !== -1 && row[currentMapping.emotion]
          ? String(row[currentMapping.emotion]).trim()
          : null;

        if (currentMapping.te !== -1 && row[currentMapping.te]) toInsert.te.push({ text: String(row[currentMapping.te]).trim().normalize("NFC"), movie_name: movieName, intended_emotion: intendedEmotion });
        if (currentMapping.en !== -1 && row[currentMapping.en]) toInsert.en.push({ text: String(row[currentMapping.en]).trim().normalize("NFC"), movie_name: movieName, intended_emotion: intendedEmotion });
        if (currentMapping.hi !== -1 && row[currentMapping.hi]) toInsert.hi.push({ text: String(row[currentMapping.hi]).trim().normalize("NFC"), movie_name: movieName, intended_emotion: intendedEmotion });
      }
    }

    // Now, process each language and insert missing ones
    let totalImported = 0;

    for (const langCode of ["te", "en", "hi"] as const) {
      // Deduplicate by text
      const uniqueTexts = new Map<string, { movie_name: string | null; intended_emotion: string | null }>();
      for (const item of toInsert[langCode]) {
        if (item.text.length > 0) uniqueTexts.set(item.text, { movie_name: item.movie_name, intended_emotion: item.intended_emotion });
      }
      
      const texts = Array.from(uniqueTexts.entries());
      if (texts.length === 0) continue;

      const langId = langMap[langCode]!;

      // Fetch existing
      const { data: existingData } = await supabaseAdmin
        .from("sentences")
        .select("normalized_text, sentence_number, intended_emotion")
        .eq("language_id", langId);

      const existingTexts = new Set((existingData as any[])?.map((r: any) => `${r.normalized_text}||${r.intended_emotion || ""}`) || []);
      let maxSentenceNumber = (existingData as any[])?.reduce((max: number, r: any) => Math.max(max, r.sentence_number), 0) || 0;

      const newSentences = texts.filter(([text, meta]) => !existingTexts.has(`${text}||${meta.intended_emotion || ""}`));
      
      if (newSentences.length > 0) {
        const insertPayload = newSentences.map(([text, meta]) => {
          maxSentenceNumber++;
          return {
            language_id: langId,
            text: text,
            normalized_text: text,
            sentence_number: maxSentenceNumber,
            is_active: true,
            movie_name: meta.movie_name,
            intended_emotion: meta.intended_emotion
          };
        });

        const { error: insertError } = await supabaseAdmin.from("sentences").insert(insertPayload as any);
        if (insertError) throw insertError;
        
        totalImported += insertPayload.length;
      }
    }

    return NextResponse.json({ 
      success: true, 
      importedCount: totalImported,
      message: totalImported > 0 
        ? `Successfully parsed Excel grid and imported ${totalImported} total transcripts across all languages.`
        : "No new transcripts to import. All found transcripts already exist."
    });

  } catch (error: any) {
    console.error("Multi-Import API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
