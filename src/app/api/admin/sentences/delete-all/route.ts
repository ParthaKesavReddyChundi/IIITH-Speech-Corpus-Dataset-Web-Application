import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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

    // 1. Delete all recordings first (to satisfy ON DELETE RESTRICT foreign keys)
    const { error: recError } = await (supabaseAdmin.from("recordings") as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (recError) throw recError;

    // 2. Delete all sentences
    const { error: senError } = await (supabaseAdmin.from("sentences") as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (senError) throw senError;

    return NextResponse.json({ success: true, message: "All sentences and recordings have been permanently deleted." });

  } catch (error: any) {
    console.error("Delete All API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
