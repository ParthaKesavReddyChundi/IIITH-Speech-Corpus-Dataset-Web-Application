import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).max(100),
  role: z.enum(["admin", "student"]),
  gender_default: z.enum(["male", "female", "other"]).optional(),
});

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createServiceClient();
    
    // Auth check
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: adminCheck } = await supabase.from("users").select("role").eq("auth_uid", user.id).single();
    if ((adminCheck as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const validatedData = createUserSchema.parse(body);

    // 1. Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: validatedData.email,
      password: validatedData.password,
      email_confirm: true,
      user_metadata: { name: validatedData.name, role: validatedData.role }
    });

    if (authError) {
      console.error("Auth creation failed:", authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authUser.user) {
      return NextResponse.json({ error: "User creation failed mysteriously" }, { status: 500 });
    }

    // 2. Insert into public.users
    const { data: appUser, error: userError } = await supabaseAdmin.from("users").insert({
      auth_uid: authUser.user.id,
      name: validatedData.name,
      role: validatedData.role,
    } as any).select().single();

    if (userError) {
      console.error("User table insertion failed:", userError);
      // Try to clean up auth user if DB insert fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 });
    }

    // 3. If student, insert into public.speakers
    if (validatedData.role === "student") {
      const { error: speakerError } = await supabaseAdmin.from("speakers").insert({
        user_id: (appUser as any).id,
        gender_default: validatedData.gender_default || null,
      } as any);

      if (speakerError) {
        console.error("Speaker table insertion failed:", speakerError);
        // Clean up everything else
        await supabaseAdmin.from("users").delete().eq("id", (appUser as any).id);
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        return NextResponse.json({ error: "Failed to create speaker profile" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "User created successfully" });

  } catch (error) {
    console.error("User Creation Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: (error as any).errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
