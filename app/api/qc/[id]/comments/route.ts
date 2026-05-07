import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { QcComment, QcPriority } from "@/lib/qc-types";

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
      section?: string;
      priority?: QcPriority;
      issue?: string;
      fix?: string;
    };

    const section = body.section?.trim();
    const issue = body.issue?.trim();
    const fix = body.fix?.trim();
    const priority = body.priority;

    if (!section || !issue || !fix || !priority) {
      return NextResponse.json(
        { error: "section, priority, issue, and fix are required" },
        { status: 400 },
      );
    }

    if (!["must_fix", "minor", "suggestion"].includes(priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }

    const { data: review, error: loadError } = await supabase
      .from("qc_reviews")
      .select("id, user_id, ai_comments")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (loadError || !review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const comments = (review.ai_comments as unknown as QcComment[]) ?? [];
    const nextId = comments.reduce((maxId, comment) => Math.max(maxId, comment.id), 0) + 1;

    const manualComment: QcComment = {
      id: nextId,
      section,
      issue,
      figma_reference: "Manual reviewer note",
      fix,
      priority,
      status: "open",
      is_manual: true,
    };

    const next = [...comments, manualComment];

    const { error: updateError } = await supabase
      .from("qc_reviews")
      .update({ ai_comments: next as unknown as Record<string, unknown>[] })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to add comment", detail: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, comment: manualComment });
  } catch (err) {
    console.error("[api/qc/:id/comments] unhandled", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
