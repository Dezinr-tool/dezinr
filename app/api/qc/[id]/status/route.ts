import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { QcComment, QcStatus } from "@/lib/qc-types";

export async function PATCH(
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
      status?: QcStatus;
    };

    if (
      typeof body.commentId !== "number" ||
      !body.status ||
      !["open", "in_progress", "resolved"].includes(body.status)
    ) {
      return NextResponse.json(
        { error: "commentId and valid status are required" },
        { status: 400 },
      );
    }

    const { data: review, error: loadError } = await supabase
      .from("qc_reviews")
      .select("id, user_id, comments")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (loadError || !review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const comments = (review.comments as unknown as QcComment[]) ?? [];
    const next = comments.map((comment) =>
      comment.id === body.commentId ? { ...comment, status: body.status! } : comment,
    );

    const { error: updateError } = await supabase
      .from("qc_reviews")
      .update({ comments: next as unknown as Record<string, unknown>[] })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update status", detail: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/qc/:id/status] unhandled", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
