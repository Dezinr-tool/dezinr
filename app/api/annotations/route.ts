import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    console.log("[api/annotations] POST start");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      analysisId?: string;
      category?: string;
      originalText?: string;
      editedText?: string;
      isAccurate?: boolean;
      addedByUser?: string;
    };

    const analysisId = body.analysisId?.trim();
    const category = body.category?.trim();
    const originalText = body.originalText?.trim() || null;
    const editedText = body.editedText?.trim() || null;
    const addedByUser = body.addedByUser?.trim() || null;

    if (!analysisId) {
      return NextResponse.json({ error: "analysisId required" }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: "category required" }, { status: 400 });
    }
    if (typeof body.isAccurate !== "boolean") {
      return NextResponse.json({ error: "isAccurate boolean required" }, { status: 400 });
    }
    if (!editedText && !addedByUser) {
      return NextResponse.json(
        { error: "editedText or addedByUser required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("annotations")
      .insert({
        analysis_id: analysisId,
        category,
        original_text: originalText,
        edited_text: editedText,
        is_accurate: body.isAccurate,
        added_by_user: addedByUser,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[api/annotations] insert", error);
      return NextResponse.json(
        { error: "Failed to save annotation", detail: error.message },
        { status: 500 },
      );
    }

    console.log("[api/annotations] saved", data.id);
    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error("[api/annotations] unhandled", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
