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

    let currentMapping: { te: number; en: number; hi: number; movie: number } | null = null;
    
    // We will collect raw sentences into these arrays
    const toInsert: { [langCode: string]: { text: string; movie_name: string | null }[] } = {
      te: [],
      en: [],
      hi: []
    };

    for (const row of rows) {
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0] || "").trim().toLowerCase();
      
      if (firstCell === "language" || firstCell === "original language") {
        currentMapping = { te: -1, en: -1, hi: -1, movie: -1 };
        for (let i = 0; i < row.length; i++) {
          const colName = String(row[i] || "").toLowerCase();
          if (colName.includes("telugu")) currentMapping.te = i;
          if (colName.includes("english")) currentMapping.en = i;
          if (colName.includes("hindi")) currentMapping.hi = i;
          if (colName.includes("movie")) currentMapping.movie = i;
        }
        continue;
      }

      // If we have a mapping and the row has data, extract
      if (currentMapping) {
        const movieName = currentMapping.movie !== -1 && row[currentMapping.movie] 
          ? String(row[currentMapping.movie]).trim() 
          : null;

        if (currentMapping.te !== -1 && row[currentMapping.te]) toInsert.te.push({ text: String(row[currentMapping.te]).trim().normalize("NFC"), movie_name: movieName });
        if (currentMapping.en !== -1 && row[currentMapping.en]) toInsert.en.push({ text: String(row[currentMapping.en]).trim().normalize("NFC"), movie_name: movieName });
        if (currentMapping.hi !== -1 && row[currentMapping.hi]) toInsert.hi.push({ text: String(row[currentMapping.hi]).trim().normalize("NFC"), movie_name: movieName });
      }
    }

    // Now, process each language and insert missing ones
    let totalImported = 0;

    for (const langCode of ["te", "en", "hi"] as const) {
      // Deduplicate by text
      const uniqueTexts = new Map<string, string | null>();
      for (const item of toInsert[langCode]) {
        if (item.text.length > 0) uniqueTexts.set(item.text, item.movie_name);
      }
      
      const texts = Array.from(uniqueTexts.entries());
      if (texts.length === 0) continue;

      const langId = langMap[langCode]!;

      // Fetch existing
      const { data: existingData } = await supabaseAdmin
        .from("sentences")
        .select("normalized_text, sentence_number")
        .eq("language_id", langId);

      const existingTexts = new Set((existingData as any[])?.map((r: any) => r.normalized_text) || []);
      let maxSentenceNumber = (existingData as any[])?.reduce((max: number, r: any) => Math.max(max, r.sentence_number), 0) || 0;

      const newSentences = texts.filter(([text]) => !existingTexts.has(text));
      
      if (newSentences.length > 0) {
        const insertPayload = newSentences.map(([text, movie_name]) => {
          maxSentenceNumber++;
          return {
            language_id: langId,
            text: text,
            normalized_text: text,
            sentence_number: maxSentenceNumber,
            is_active: true,
            movie_name: movie_name
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
