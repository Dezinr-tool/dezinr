import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    console.log("[api/history] GET start");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("analyses")
      .select("id, input_type, input_value, score, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api/history] select", error);
      return NextResponse.json(
        { error: "Failed to load history", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ analyses: data ?? [] });
  } catch (err) {
    console.error("[api/history] unhandled", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
