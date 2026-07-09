"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteMyRecording(recordingId: string) {
  const supabase = await createClient();
  
  // Since we use createClient(), this executes with the authenticated user's privileges.
  // The RLS policy "student_update_own_recordings" ensures they can only update their own row.
  const { error } = await supabase
    .from("recordings")
    .update({ status: "deleted" } as never)
    .eq("id", recordingId);

  if (error) {
    console.error("Failed to delete recording:", error);
    return { success: false, error: "Failed to delete recording. It may not exist or you lack permission." };
  }

  // Revalidate the student dashboard and recordings pages to reflect the freed sentence
  revalidatePath("/student/dashboard", "page");
  revalidatePath("/student/recordings", "page");
  revalidatePath("/student/record/[language]", "page");

  return { success: true };
}
