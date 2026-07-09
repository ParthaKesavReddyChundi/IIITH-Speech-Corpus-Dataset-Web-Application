"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function flagRecording(recordingId: string) {
  const supabaseAdmin = createServiceClient();
  const query = supabaseAdmin.from("recordings") as any;
  const { error } = await query
    .update({ status: "flagged_for_rerecord" })
    .eq("id", recordingId);
  
  if (error) throw new Error(error.message);
  revalidatePath("/admin/recordings");
  return { success: true };
}

export async function deleteRecording(recordingId: string) {
  const supabaseAdmin = createServiceClient();
  const query = supabaseAdmin.from("recordings") as any;
  const { error } = await query
    .update({ status: "deleted" })
    .eq("id", recordingId);
  
  if (error) throw new Error(error.message);
  revalidatePath("/admin/recordings");
  return { success: true };
}
