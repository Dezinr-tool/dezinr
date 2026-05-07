import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    console.log("[api/feedback] POST start");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      analysisId?: string;
      isHelpful?: boolean;
      userComment?: string;
    };

    const analysisId = body.analysisId?.trim();
    if (!analysisId) {
      return NextResponse.json({ error: "analysisId required" }, { status: 400 });
    }
    if (typeof body.isHelpful !== "boolean") {
      return NextResponse.json({ error: "isHelpful boolean required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("feedback")
      .insert({
        analysis_id: analysisId,
        user_id: user.id,
        is_helpful: body.isHelpful,
        user_comment: body.userComment?.trim() || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[api/feedback] insert", error);
      return NextResponse.json(
        { error: "Failed to save feedback", detail: error.message },
        { status: 500 },
      );
    }

    console.log("[api/feedback] saved", data.id);
    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error("[api/feedback] unhandled", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
