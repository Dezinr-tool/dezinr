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
      x_percent?: number;
      y_percent?: number;
    };

    const section = body.section?.trim() || "Other";
    const issue = body.issue?.trim();
    const fix = body.fix?.trim() || "Manual reviewer note";
    const priority = body.priority;
    const xPercent = typeof body.x_percent === "number" ? body.x_percent : undefined;
    const yPercent = typeof body.y_percent === "number" ? body.y_percent : undefined;

    if (!issue || !priority) {
      return NextResponse.json(
        { error: "priority and issue are required" },
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
      x_percent: xPercent,
      y_percent: yPercent,
    };

    const next = [...comments, manualComment];
    const nextTotal = next.length;
    const nextMustFix = next.filter((comment) => comment.priority === "must_fix").length;
    const nextMinor = next.filter((comment) => comment.priority === "minor").length;
    const nextSuggestion = next.filter((comment) => comment.priority === "suggestion").length;

    const { error: updateError } = await supabase
      .from("qc_reviews")
      .update({
        ai_comments: next as unknown as Record<string, unknown>[],
        total_issues: nextTotal,
        must_fix_count: nextMustFix,
        minor_count: nextMinor,
        suggestion_count: nextSuggestion,
      })
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
