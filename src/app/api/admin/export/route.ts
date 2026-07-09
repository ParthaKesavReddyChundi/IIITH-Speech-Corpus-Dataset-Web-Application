import { NextResponse } from "next/server";
import { createServiceClient, createClient } from "@/lib/supabase/server";
import { buildCsv } from "@/lib/export/csvBuilder";
import { generateReadme } from "@/lib/export/readmeGenerator";
import JSZip from "jszip";

export async function POST() {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (status: string, progress: number, url?: string, message?: string) => {
        controller.enqueue(
          encoder.encode(JSON.stringify({ status, progress, url, message }) + "\n")
        );
      };

      try {
        const supabaseAuth = await createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user) {
          sendUpdate("error", 0, undefined, "Unauthorized");
          controller.close();
          return;
        }

        const { data: adminCheck } = await supabaseAuth.from("users").select("role").eq("auth_uid", user.id).single();
        if ((adminCheck as any)?.role !== "admin") {
          sendUpdate("error", 0, undefined, "Forbidden");
          controller.close();
          return;
        }

        const supabase = createServiceClient();
        
        sendUpdate("progress", 5);

        const { data: recordingsData, error: fetchError } = await supabase
          .from("recordings")
          .select(`
            id,
            audio_path,
            duration_seconds,
            sentences ( id, text, sentence_number ),
            speakers ( id, gender_default, users ( name ) ),
            languages ( id, name, code ),
            emotions ( id, name )
          `)
          .eq("status", "verified");
        
        const recordings = recordingsData as any[];

        if (fetchError) throw fetchError;
        if (!recordings || recordings.length === 0) {
          throw new Error("No verified recordings found to export.");
        }

        sendUpdate("progress", 10);
        const zip = new JSZip();
        const audioFolder = zip.folder("audio");

        let downloaded = 0;
        let totalDuration = 0;
        const languagesCount: Record<string, number> = {};

        // Download all files and add to zip
        for (const r of recordings) {
          if (!r.audio_path) continue;
          
          const studentNameRaw = r.speakers?.users?.name || r.speakers?.id || "unknown";
          const studentName = studentNameRaw.replace(/[^a-zA-Z0-9_ -]/g, "").trim();
          const langName = (r.languages?.name || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
          const emotionName = (r.emotions?.name || "unknown").replace(/[^a-zA-Z0-9_-]/g, "");
          const sentenceNum = String(r.sentences?.sentence_number || 0).padStart(3, '0');
          
          const fileName = `${sentenceNum}_${emotionName}.wav`;
          
          // Attach export path for the CSV
          r.export_file_path = `audio/${studentName}/${langName}/${fileName}`;
          
          // Folder structure: audio/StudentName/LanguageName/fileName
          const studentFolder = audioFolder?.folder(studentName);
          const langFolder = studentFolder?.folder(langName);

          const { data: fileData, error: downloadError } = await supabase.storage
            .from("recordings")
            .download(r.audio_path);

          if (!downloadError && fileData) {
            langFolder?.file(fileName, await fileData.arrayBuffer());
            
            // Stats
            totalDuration += (r.duration_seconds || 0);
            languagesCount[langName] = (languagesCount[langName] || 0) + 1;
          }
          
          downloaded++;
          // Report progress between 10% and 80%
          const pct = Math.floor(10 + (downloaded / recordings.length) * 70);
          sendUpdate("progress", pct);
        }

        // Generate metadata
        sendUpdate("progress", 85);
        const csvContent = buildCsv(recordings);
        zip.file("metadata.csv", csvContent);

        // Generate README
        const readmeContent = generateReadme({
          totalRecordings: recordings.length,
          totalDuration,
          languages: languagesCount
        });
        zip.file("README.md", readmeContent);

        // Generate ZIP buffer
        sendUpdate("progress", 90);
        const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });

        // Upload ZIP to storage
        sendUpdate("progress", 95);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const zipFileName = `exports/iiith-speech-corpus-${timestamp}.zip`;
        
        const { error: uploadError } = await supabase.storage
          .from("recordings")
          .upload(zipFileName, zipBuffer, {
            contentType: "application/zip",
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Create signed URL
        const { data: signedUrlData } = await supabase.storage
          .from("recordings")
          .createSignedUrl(zipFileName, 24 * 60 * 60); // 24 hours

        if (!signedUrlData?.signedUrl) {
          throw new Error("Failed to generate download URL");
        }

        // Finalize
        sendUpdate("complete", 100, signedUrlData.signedUrl);
        controller.close();
      } catch (err: any) {
        console.error("Export error:", err);
        sendUpdate("error", 0, undefined, err.message || "Unknown error occurred");
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
