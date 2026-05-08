import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      commentId?: number;
      is_valid?: boolean;
      is_edited?: boolean;
      original_text?: string;
      edited_text?: string;
    };

    if (typeof body.commentId !== "number") {
      return NextResponse.json({ error: "commentId is required" }, { status: 400 });
    }

    const isValid = body.is_valid === true;
    const isEdited = body.is_edited === true;
    if (!isValid && !isEdited) {
      return NextResponse.json({ error: "Either is_valid or is_edited must be true" }, { status: 400 });
    }

    const { data: review, error: reviewError } = await supabase
      .from("qc_reviews")
      .select("id, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const insertPayload = {
      review_id: id,
      comment_id: body.commentId,
      user_id: user.id,
      is_valid: isValid,
      is_edited: isEdited,
      original_text: body.original_text?.trim() || null,
      edited_text: body.edited_text?.trim() || null,
    };

    const { data, error } = await supabase
      .from("qc_feedback")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to save QC feedback", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error("[api/qc/:id/feedback] unhandled", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
