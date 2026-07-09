import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import crypto from "crypto";

const uploadSchema = z.object({
  clientUploadId: z.string().uuid(),
  sentenceId: z.string().uuid(),
  speakerId: z.string().uuid(),
  languageId: z.string().uuid(),
  emotionId: z.string().uuid(),
  gender: z.enum(["male", "female", "other"]),
  durationSeconds: z.coerce.number(),
  checksum: z.string(),
});

export async function POST(req: Request) {
  try {
    const supabaseClient = await createClient();
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const metadataStr = formData.get("metadata") as string;

    if (!file || !metadataStr) {
      return NextResponse.json({ error: "Missing file or metadata" }, { status: 400 });
    }

    const metadata = uploadSchema.parse(JSON.parse(metadataStr));

    const arrayBuffer = await file.arrayBuffer();
    const serverBuffer = Buffer.from(arrayBuffer);
    const serverChecksum = crypto.createHash("sha256").update(serverBuffer).digest("hex");

    let isVerified = true;
    let finalStatus = "verified";

    if (serverChecksum !== metadata.checksum) {
      console.error("Checksum mismatch");
      isVerified = false;
      finalStatus = "failed";
    }

    const supabaseAdmin = createServiceClient();

    // Fetch the next sample number using the RPC function
    const { data: sampleNumberData, error: sampleError } = await supabaseAdmin
      .rpc("compute_next_sample_number", { 
        p_speaker_id: metadata.speakerId, 
        p_language_id: metadata.languageId 
      } as any);

    const sampleNumber = sampleError ? 1 : (sampleNumberData as unknown as number);

    const filePath = `${metadata.speakerId}/${metadata.languageId}/${metadata.clientUploadId}.wav`;

    const { error: storageError } = await supabaseAdmin
      .storage
      .from("recordings")
      .upload(filePath, serverBuffer, {
        contentType: "audio/wav",
        upsert: true,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
    }

    // 6. Insert / Upsert into the recordings table
    const { data: recording, error: dbError } = await supabaseAdmin
      .from("recordings")
      .upsert({
        client_upload_id: metadata.clientUploadId,
        speaker_id: metadata.speakerId,
        sentence_id: metadata.sentenceId,
        language_id: metadata.languageId,
        emotion_id: metadata.emotionId,
        gender: metadata.gender,
        sample_number: sampleNumber,
        audio_path: filePath,
        checksum_sha256: serverChecksum,
        duration_seconds: metadata.durationSeconds,
        sample_rate: 16000,
        bit_depth: 16,
        channels: 1,
        status: finalStatus as any,
        recorded_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
        verified_at: isVerified ? new Date().toISOString() : null,
      } as any, { onConflict: "client_upload_id" })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      // Compensating transaction: attempt to clean up storage if DB fails
      await supabaseAdmin.storage.from("recordings").remove([filePath]);
      return NextResponse.json({ error: "Database insert failed" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      recording, 
      status: finalStatus 
    });

  } catch (error) {
    console.error("Upload API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
